import * as z from "zod";
import { fixturePlaidTransaction } from "../../../test/finance-fixtures.js";
import { type PlaidClient, PlaidError } from "./client.js";
import { readTransactionChanges } from "./sync.js";

function page(
  nextCursor: string,
  more: boolean,
  added: unknown[] = [],
  modified: unknown[] = [],
  removed: unknown[] = [],
) {
  return {
    next_cursor: nextCursor,
    has_more: more,
    added,
    modified,
    removed,
  };
}
describe("Plaid incremental synchronization", () => {
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
    const request = vi.fn(async (_path: string, _body: object) => responses.shift());
    const client: PlaidClient = async (path, body, schema) =>
      schema.parse(await request(path, body));
    const changes = await readTransactionChanges(client, "fixture", "plaid/item_1", "original");
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
  it("restarts the whole batch from the original cursor after a pagination mutation", async () => {
    const cursors: unknown[] = [];
    let calls = 0;
    const client: PlaidClient = async (_path, body, schema) => {
      cursors.push(
        z
          .object({
            cursor: z.string().nullable(),
          })
          .parse(body).cursor,
      );
      calls++;
      if (calls === 2) {
        throw new PlaidError("TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION");
      }
      return schema.parse(
        calls === 1
          ? page("second", true, [
              fixturePlaidTransaction("discard"),
            ])
          : page("final", false, [
              fixturePlaidTransaction("keep"),
            ]),
      );
    };
    const changes = await readTransactionChanges(client, "fixture", "plaid/item_1", "original");
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
    let calls = 0;
    const client: PlaidClient = async () => {
      calls++;
      throw new PlaidError("TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION");
    };
    await expect(readTransactionChanges(client, "fixture", "plaid/item_1", null)).rejects.toThrow(
      "Plaid request failed",
    );
    expect(calls).toBe(3);
  });
});
