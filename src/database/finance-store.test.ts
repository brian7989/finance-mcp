import { evictDurableObject, runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import {
  fixtureAccount,
  fixtureBalance,
  fixtureConnection,
  fixturePlaidAccount,
  fixtureTransaction,
} from "../../test/finance-fixtures.js";
import { encryptCredential } from "../common/utils/encryption.js";
import { createDatabase } from "./client.js";
import removeCombinedHsa from "./migrations/0001_remove_combined_hsa.sql";
import { saveSnapshot } from "./repositories/accounts.js";
import { readSyncCursor, saveConnection } from "./repositories/connections.js";
import { saveTransactionChanges } from "./repositories/transactions.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
function testStore() {
  return env.FINANCE_STORE.getByName(crypto.randomUUID());
}
async function seedStore(stub: ReturnType<typeof testStore>): Promise<void> {
  const credential = await encryptCredential(env, "plaid/item_1", "fixture-access");
  await runInDurableObject(stub, async (_instance, context) => {
    saveConnection(createDatabase(context.storage), fixtureConnection(), credential);
    saveSnapshot(createDatabase(context.storage), "plaid/item_1", {
      accounts: [
        fixtureAccount(),
      ],
      balances: [
        fixtureBalance(),
      ],
      holdings: [],
    });
  });
}
describe("durable finance history", () => {
  it("retires a combined HSA account and removes only its archived data without double counting", async () => {
    const stub = testStore();
    const parent = {
      ...fixtureAccount("benepass/workspace/hsa", "hsa"),
      connection_id: "benepass",
      provider_account_id: "hsa",
      name: "Benepass HSA",
    };
    const components = [
      "cash",
      "investments",
    ].map((component) => ({
      ...parent,
      id: `${parent.id}/${component}`,
      provider_account_id: `hsa/${component}`,
      name: `HSA ${component}`,
    }));
    await runInDurableObject(stub, async (_instance, context) => {
      const db = createDatabase(context.storage);
      saveConnection(
        db,
        {
          ...fixtureConnection("benepass"),
          provider: "benepass",
          institution: "Benepass",
          last_success_at: new Date().toISOString(),
        },
        null,
      );
      context.storage.transactionSync(() =>
        saveSnapshot(db, "benepass", {
          accounts: [
            parent,
          ],
          balances: [
            fixtureBalance(parent.id, "7103.09", new Date().toISOString()),
          ],
          holdings: [],
        }),
      );
      context.storage.transactionSync(() =>
        saveSnapshot(db, "benepass", {
          accounts: components,
          balances: [
            fixtureBalance(components[0]?.id, "100", new Date().toISOString()),
            fixtureBalance(components[1]?.id, "7003.09", new Date().toISOString()),
          ],
          holdings: [],
        }),
      );
    });
    const accounts = (await stub.accounts()).accounts;
    expect(accounts.filter((account) => account.active)).toHaveLength(2);
    expect(accounts.find((account) => account.provider_account_id === "hsa")?.active).toBe(false);
    expect((await stub.netWorth()).totals).toEqual([
      {
        currency: "USD",
        amount: "7103.09",
      },
    ]);
    expect((await stub.balanceHistory({})).observations).toHaveLength(3);
    await runInDurableObject(stub, async (_instance, context) => {
      context.storage.transactionSync(() => {
        for (const statement of removeCombinedHsa.split("--> statement-breakpoint")) {
          context.storage.sql.exec(statement);
        }
      });
    });
    const remaining = (await stub.accounts()).accounts;
    expect(remaining).toHaveLength(2);
    expect(remaining.every((account) => account.active)).toBe(true);
    expect((await stub.balanceHistory({})).observations).toHaveLength(2);
    expect((await stub.netWorth()).totals).toEqual([
      {
        currency: "USD",
        amount: "7103.09",
      },
    ]);
  });
  it("retains daily observations after eviction and replaces same-day readings", async () => {
    const stub = testStore();
    await seedStore(stub);
    await runInDurableObject(stub, async (_instance, context) => {
      saveSnapshot(createDatabase(context.storage), "plaid/item_1", {
        accounts: [
          fixtureAccount(),
        ],
        balances: [
          fixtureBalance(undefined, "120"),
          fixtureBalance(undefined, "80", "2026-10-09T09:17:00.000Z"),
        ],
        holdings: [],
      });
    });
    await evictDurableObject(stub);
    const history = await stub.balanceHistory({});
    expect(history.observations.map((value) => value.current)).toEqual([
      "120",
      "80",
    ]);
    expect((await stub.balances()).balances[0]?.current).toBe("120");
    expect(
      (
        await stub.balanceHistory({
          start_date: "2026-10-09",
          end_date: "2026-10-09",
        })
      ).observations,
    ).toHaveLength(1);
  });
  it("atomically saves transaction corrections, removals, and cursor", async () => {
    const stub = testStore();
    await seedStore(stub);
    await runInDurableObject(stub, async (_instance, context) => {
      context.storage.transactionSync(() =>
        saveTransactionChanges(createDatabase(context.storage), "plaid/item_1", {
          transactions: [
            fixtureTransaction("a"),
            fixtureTransaction("b"),
          ],
          removed: [],
          cursor: "first",
        }),
      );
      context.storage.transactionSync(() =>
        saveTransactionChanges(createDatabase(context.storage), "plaid/item_1", {
          transactions: [
            {
              ...fixtureTransaction("a"),
              amount: "-20",
            },
          ],
          removed: [
            "b",
          ],
          cursor: "second",
        }),
      );
      expect(readSyncCursor(createDatabase(context.storage), "plaid/item_1")).toBe("second");
      expect(() =>
        context.storage.transactionSync(() => {
          saveTransactionChanges(createDatabase(context.storage), "plaid/item_1", {
            transactions: [],
            removed: [
              "a",
            ],
            cursor: "broken",
          });
          throw new Error("rollback");
        }),
      ).toThrow();
      expect(readSyncCursor(createDatabase(context.storage), "plaid/item_1")).toBe("second");
    });
    await evictDurableObject(stub);
    expect((await stub.transactions({})).transactions).toHaveLength(1);
    expect((await stub.transactions({})).transactions[0]?.amount).toBe("-20");
  });
  it("keeps preferences independent of provider snapshots", async () => {
    const stub = testStore();
    await seedStore(stub);
    const preference = {
      account_id: fixtureAccount().id,
      label: "Dad",
      include_in_net_worth: false,
      include_in_spending: false,
    };
    const originalId = (await stub.accounts()).accounts[0]?.id;
    expect(originalId).not.toBe(fixtureAccount().id);
    await stub.setPreference(preference);
    await seedStore(stub);
    await evictDurableObject(stub);
    expect((await stub.accounts()).accounts[0]?.id).toBe(originalId);
    expect((await stub.accounts()).preferences[0]).toMatchObject({
      ...preference,
      account_id: (await stub.accounts()).accounts[0]?.id,
    });
    await runInDurableObject(stub, async (instance) => {
      await expect(
        instance.setPreference({
          ...preference,
          account_id: "unknown",
        }),
      ).rejects.toThrow();
    });
  });
  it("recovers metadata after a temporary provider failure", async () => {
    const stub = testStore();
    await seedStore(stub);
    let unavailable = true;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = new URL(new Request(input, init).url).pathname;
        if (path === "/item/get") {
          if (unavailable) {
            return Response.json(
              {
                error_code: "INTERNAL_SERVER_ERROR",
              },
              {
                status: 500,
              },
            );
          }
          return Response.json({
            item: {
              item_id: "item_1",
              institution_id: null,
              billed_products: [
                "transactions",
              ],
              available_products: [],
            },
          });
        }
        if (path === "/accounts/get") {
          return Response.json({
            accounts: [
              fixturePlaidAccount(),
            ],
          });
        }
        return Response.json({
          added: [],
          modified: [],
          removed: [],
          next_cursor: "recovered",
          has_more: false,
        });
      }),
    );
    expect((await stub.syncConnection("plaid/item_1")).ok).toBe(false);
    expect((await stub.connections()).connections[0]?.last_error).not.toBeNull();
    unavailable = false;
    expect((await stub.syncConnection("plaid/item_1")).ok).toBe(true);
    expect((await stub.connections()).connections[0]?.last_error).toBeNull();
    expect((await stub.connections()).connections[0]?.capabilities).toContain("transactions");
  });
  it("records normalized provider authentication failures as reconnection requirements", async () => {
    const stub = testStore();
    await seedStore(stub);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          {
            error_code: "ITEM_LOGIN_REQUIRED",
          },
          {
            status: 400,
          },
        ),
      ),
    );
    expect((await stub.syncConnection("plaid/item_1")).ok).toBe(false);
    expect((await stub.connections()).connections[0]).toMatchObject({
      status: "needs_reconnection",
      last_error: "Sign in again to restore access.",
    });
  });
  it("completes disconnect when Plaid reports the Item was already removed", async () => {
    const stub = testStore();
    await seedStore(stub);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          {
            error_code: "ITEM_NOT_FOUND",
          },
          {
            status: 400,
          },
        ),
      ),
    );
    await stub.disconnect("plaid/item_1");
    expect((await stub.connections()).connections[0]).toMatchObject({
      status: "disconnected",
      last_error: null,
    });
    await stub.disconnect("plaid/item_1");
  });
  it("coalesces concurrent refreshes and never exposes stored credentials", async () => {
    const stub = testStore();
    await seedStore(stub);
    let accountReads = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = input instanceof Request ? input.url : String(input);
        if (url.endsWith("/item/get")) {
          return Response.json({
            item: {
              item_id: "item_1",
              institution_id: null,
              billed_products: [
                "transactions",
              ],
              available_products: [],
            },
          });
        }
        if ((input instanceof Request ? input.url : String(input)).endsWith("/accounts/get")) {
          accountReads++;
          return Response.json({
            accounts: [
              fixturePlaidAccount(),
            ],
          });
        }
        return Response.json({
          added: [],
          modified: [],
          removed: [],
          next_cursor: "next",
          has_more: false,
        });
      }),
    );
    const results = await runInDurableObject(stub, async (instance) =>
      Promise.all([
        instance.syncConnection("plaid/item_1"),
        instance.syncConnection("plaid/item_1"),
      ]),
    );
    expect(results.every((value) => value.ok)).toBe(true);
    expect(accountReads).toBe(1);
    expect(JSON.stringify(await stub.connections())).not.toContain("fixture-access");
  });
  it("blocks a delayed refresh after disconnect without erasing history", async () => {
    const stub = testStore();
    await seedStore(stub);
    await runInDurableObject(stub, async (instance) => {
      let finish!: (response: Response) => void;
      let started!: () => void;
      const pending = new Promise<Response>((resolve) => {
        finish = resolve;
      });
      const requested = new Promise<void>((resolve) => {
        started = resolve;
      });
      vi.stubGlobal(
        "fetch",
        vi.fn(async (input: string | URL) => {
          if ((input instanceof Request ? input.url : String(input)).endsWith("/item/remove")) {
            return Response.json({});
          }
          started();
          return pending;
        }),
      );
      const refreshing = instance.syncConnection("plaid/item_1");
      await requested;
      await instance.disconnect("plaid/item_1");
      finish(
        Response.json({
          accounts: [
            {
              ...fixturePlaidAccount(),
              balances: {
                ...fixturePlaidAccount().balances,
                current: 999,
              },
            },
          ],
        }),
      );
      expect((await refreshing).ok).toBe(false);
    });
    expect((await stub.balances()).balances[0]?.current).toBe("100.00");
    expect((await stub.connections()).connections[0]?.status).toBe("disconnected");
    expect((await stub.accounts()).accounts[0]?.active).toBe(false);
    expect((await stub.netWorth()).totals).toEqual([]);
    await stub.disconnect("plaid/item_1");
  });
});
