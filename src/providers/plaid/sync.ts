import type { Transaction } from "../../finance/schemas.js";
import { accountId } from "./accounts.js";
import { type PlaidClient, PlaidError } from "./client.js";
import { SyncResponseSchema } from "./schemas.js";
import { mapPlaidTransaction } from "./transactions.js";

export type TransactionChanges = {
  transactions: Transaction[];
  removed: string[];
  cursor: string;
};

export async function readTransactionChanges(
  client: PlaidClient,
  token: string,
  connectionId: string,
  cursor: string | null,
): Promise<TransactionChanges> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await readAllSyncPages(client, token, connectionId, cursor);
    } catch (error) {
      if (
        !(error instanceof PlaidError) ||
        error.code !== "TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION"
      ) {
        throw error;
      }
    }
  }
  throw new PlaidError("SYNC_RETRY_EXHAUSTED");
}
async function readAllSyncPages(
  client: PlaidClient,
  token: string,
  connectionId: string,
  initialCursor: string | null,
): Promise<TransactionChanges> {
  const transactions = new Map<string, Transaction>();
  const removed = new Set<string>();
  let cursor = initialCursor;
  // Bound each run; never persist a cursor without its corresponding complete update.
  for (let page = 0; page < 20; page++) {
    const response = await client(
      "/transactions/sync",
      {
        access_token: token,
        cursor,
        count: 500,
      },
      SyncResponseSchema,
    );
    for (const value of [
      ...response.added,
      ...response.modified,
    ]) {
      const transaction = mapPlaidTransaction(value, connectionId);
      transactions.set(transaction.id, transaction);
      removed.delete(transaction.id);
    }
    for (const value of response.removed) {
      const id = accountId(connectionId, value.transaction_id);
      transactions.delete(id);
      removed.add(id);
    }
    cursor = response.next_cursor;
    if (!response.has_more) {
      return {
        transactions: [
          ...transactions.values(),
        ],
        removed: [
          ...removed,
        ],
        cursor,
      };
    }
  }
  throw new PlaidError("SYNC_PAGE_LIMIT");
}
