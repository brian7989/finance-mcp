import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import type { Query, Transaction } from "../../modules/finance/schemas.js";
import type { TransactionChanges } from "../../modules/integrations/provider.js";
import type { FinanceDatabase } from "../client.js";
import { accounts, connections, transactions } from "../schema.js";
import { resolveStoredAccountId } from "./accounts.js";

export function saveTransactionChanges(
  db: FinanceDatabase,
  connectionId: string,
  changes: TransactionChanges,
): void {
  upsertTransactions(db, changes.transactions);
  for (const id of changes.removed) {
    db.delete(transactions).where(eq(transactions.id, id)).run();
  }
  db.update(connections)
    .set({
      cursor: changes.cursor,
    })
    .where(eq(connections.id, connectionId))
    .run();
}
export function upsertTransactions(db: FinanceDatabase, values: Transaction[]): void {
  for (const transaction of values) {
    saveTransaction(db, transaction);
  }
}
export function replaceInvestmentActivity(
  db: FinanceDatabase,
  connectionId: string,
  values: Transaction[],
  startDate: string,
  endDate: string,
): void {
  const selected = db
    .select({
      id: accounts.id,
    })
    .from(accounts)
    .where(eq(accounts.connection_id, connectionId));
  db.delete(transactions)
    .where(
      and(
        inArray(transactions.account_id, selected),
        sql`json_extract(${transactions.payload}, '$.kind') = 'investment'`,
        gte(transactions.date, startDate),
        lte(transactions.date, endDate),
      ),
    )
    .run();
  upsertTransactions(db, values);
}
export function listStoredTransactions(db: FinanceDatabase, query: Query): Transaction[] {
  return db
    .select({
      payload: transactions.payload,
    })
    .from(transactions)
    .where(
      and(
        query.account_id ? eq(transactions.account_id, query.account_id) : undefined,
        query.start_date ? gte(transactions.date, query.start_date) : undefined,
        query.end_date ? lte(transactions.date, query.end_date) : undefined,
      ),
    )
    .orderBy(desc(transactions.date), transactions.id)
    .limit(query.limit)
    .offset(query.offset)
    .all()
    .map((row) => row.payload);
}

function saveTransaction(db: FinanceDatabase, transaction: Transaction): void {
  const payload = {
    ...transaction,
    account_id: resolveStoredAccountId(db, transaction.account_id),
  };
  const row = {
    id: payload.id,
    account_id: payload.account_id,
    date: payload.date,
    pending: payload.pending,
    payload,
  };
  db.insert(transactions)
    .values(row)
    .onConflictDoUpdate({
      target: transactions.id,
      set: row,
    })
    .run();
}
