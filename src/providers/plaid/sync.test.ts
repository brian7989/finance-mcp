import { env } from "cloudflare:workers";
import { fixturePlaidTransaction } from "../../../test/finance-fixtures.js";
import { createPlaidClient } from "./client.js";
import { readTransactionChanges } from "./sync.js";

afterEach(() => {
  vi.unstubAllGlobals();
});
function page(
  cursor: string,
  more: boolean,
  added: unknown[] = [],
  modified: unknown[] = [],
  removed: unknown[] = [],
) {
  return {
    next_cursor: cursor,
    has_more: more,
    added,
    modified,
    removed,
  };
}
describe("Plaid SDK incremental synchronization", () => {
  it("combines additions, corrections, and removals across pages", async () => {
    const responses = [
      page("page2", true, [
        fixturePlaidTransaction("a", true),
        fixturePlaidTransaction("b"),
      ]),
      page(
        "final",
        false,
        [],
        [
          fixturePlaidTransaction("a", false),
        ],
        [
          {
            transaction_id: "b",
            account_id: "account_1",
          },
        ],
      ),
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(responses.shift())),
    );
    const changes = await readTransactionChanges(
      createPlaidClient(env),
      "fixture",
      "plaid/item_1",
      "original",
    );
    expect(changes.transactions).toHaveLength(1);
    expect(changes.transactions[0]).toMatchObject({
      id: "plaid/item_1/a",
      pending: false,
      amount: "-10.5",
    });
    expect(changes.removed).toEqual([
      "plaid/item_1/b",
    ]);
    expect(changes.cursor).toBe("final");
  });
  it("restarts from the original cursor after a pagination mutation", async () => {
    const cursors: unknown[] = [];
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const body = await new Request(input, init).json<{
          cursor?: string;
        }>();
        cursors.push(body.cursor);
        calls++;
        if (calls === 2) {
          return Response.json(
            {
              error_code: "TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION",
            },
            {
              status: 400,
            },
          );
        }
        return Response.json(
          calls === 1
            ? page("second", true, [
                fixturePlaidTransaction("discard"),
              ])
            : page("final", false, [
                fixturePlaidTransaction("keep"),
              ]),
        );
      }),
    );
    const changes = await readTransactionChanges(
      createPlaidClient(env),
      "fixture",
      "plaid/item_1",
      "original",
    );
    expect(cursors).toEqual([
      "original",
      "second",
      "original",
    ]);
    expect(changes.transactions.map((value) => value.id)).toEqual([
      "plaid/item_1/keep",
    ]);
  });
  it("bounds repeated pagination mutations", async () => {
    const fetch = vi.fn(async () =>
      Response.json(
        {
          error_code: "TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION",
        },
        {
          status: 400,
        },
      ),
    );
    vi.stubGlobal("fetch", fetch);
    await expect(
      readTransactionChanges(createPlaidClient(env), "fixture", "plaid/item_1", null),
    ).rejects.toThrow("Plaid request failed");
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
