import type * as z from "zod";
import type { Transaction } from "../../../../finance/schemas.js";
import type { TransactionChanges } from "../../../provider.js";
import { type PlaidClient, PlaidError, readPlaidResponse } from "../../client.js";
import { SyncResponseSchema } from "../../schemas.js";
import { accountId } from "../accounts.js";
import { mapPlaidTransaction } from "./transactions.js";
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
      if (!isPaginationMutation(error)) {
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
  const state: SyncState = {
    transactions: new Map(),
    removed: new Set(),
  };
  let cursor = initialCursor;
  // Never persist a cursor without its corresponding complete update.
  for (let page = 0; page < 20; page++) {
    const response = await readSyncPage(client, token, cursor);
    applySyncPage(state, response, connectionId);
    cursor = response.next_cursor;
    if (!response.has_more) {
      return completedChanges(state, cursor);
    }
  }
  throw new PlaidError("SYNC_PAGE_LIMIT");
}

type SyncPage = z.infer<typeof SyncResponseSchema>;
type SyncState = {
  transactions: Map<string, Transaction>;
  removed: Set<string>;
};
function applySyncPage(state: SyncState, response: SyncPage, connectionId: string): void {
  for (const value of [
    ...response.added,
    ...response.modified,
  ]) {
    const transaction = mapPlaidTransaction(value, connectionId);
    state.transactions.set(transaction.id, transaction);
    state.removed.delete(transaction.id);
  }
  for (const value of response.removed) {
    const id = accountId(connectionId, value.transaction_id);
    state.transactions.delete(id);
    state.removed.add(id);
  }
}

function isPaginationMutation(error: unknown): boolean {
  return (
    error instanceof PlaidError && error.code === "TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION"
  );
}

async function readSyncPage(
  client: PlaidClient,
  token: string,
  cursor: string | null,
): Promise<SyncPage> {
  return readPlaidResponse(
    SyncResponseSchema,
    client.transactionsSync({
      access_token: token,
      ...(cursor
        ? {
            cursor,
          }
        : {}),
      count: 500,
    }),
  );
}
function completedChanges(state: SyncState, cursor: string): TransactionChanges {
  return {
    transactions: [
      ...state.transactions.values(),
    ],
    removed: [
      ...state.removed,
    ],
    cursor,
  };
}
