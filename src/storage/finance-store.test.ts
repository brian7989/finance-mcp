import { evictDurableObject, runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import {
  fixtureAccount,
  fixtureBalance,
  fixtureConnection,
  fixturePlaidAccount,
  fixtureTransaction,
} from "../../test/finance-fixtures.js";
import { saveSnapshot } from "./accounts.js";
import { readSyncCursor, saveConnection } from "./connections.js";
import { encryptCredential } from "./credentials.js";
import { saveTransactionChanges } from "./transactions.js";

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
    saveConnection(context.storage.sql, fixtureConnection(), credential);
    saveSnapshot(context.storage.sql, "plaid/item_1", {
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
  it("retains daily observations after eviction and replaces same-day readings", async () => {
    const stub = testStore();
    await seedStore(stub);
    await runInDurableObject(stub, async (_instance, context) => {
      saveSnapshot(context.storage.sql, "plaid/item_1", {
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
        saveTransactionChanges(context.storage.sql, "plaid/item_1", {
          transactions: [
            fixtureTransaction("a"),
            fixtureTransaction("b"),
          ],
          removed: [],
          cursor: "first",
        }),
      );
      context.storage.transactionSync(() =>
        saveTransactionChanges(context.storage.sql, "plaid/item_1", {
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
      expect(readSyncCursor(context.storage.sql, "plaid/item_1")).toBe("second");
      expect(() =>
        context.storage.transactionSync(() => {
          saveTransactionChanges(context.storage.sql, "plaid/item_1", {
            transactions: [],
            removed: [
              "a",
            ],
            cursor: "broken",
          });
          throw new Error("rollback");
        }),
      ).toThrow();
      expect(readSyncCursor(context.storage.sql, "plaid/item_1")).toBe("second");
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
    await stub.setPreference(preference);
    await seedStore(stub);
    await evictDurableObject(stub);
    expect((await stub.accounts()).preferences).toEqual([
      preference,
    ]);
    await runInDurableObject(stub, async (instance) => {
      await expect(
        instance.setPreference({
          ...preference,
          account_id: "unknown",
        }),
      ).rejects.toThrow();
    });
  });
  it("coalesces concurrent refreshes and never exposes stored credentials", async () => {
    const stub = testStore();
    await seedStore(stub);
    let accountReads = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        if (String(input).endsWith("/accounts/get")) {
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
          if (String(input).endsWith("/item/remove")) {
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
  });
});
