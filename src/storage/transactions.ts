import { type Query, type Transaction, TransactionSchema } from "../finance/schemas.js";
import type { TransactionChanges } from "../providers/plaid/sync.js";

export function saveTransactionChanges(
  sql: SqlStorage,
  connectionId: string,
  changes: TransactionChanges,
): void {
  upsertTransactions(sql, changes.transactions);
  for (const id of changes.removed) {
    sql.exec("DELETE FROM transactions WHERE id = ?", id);
  }
  sql.exec("UPDATE connections SET cursor = ? WHERE id = ?", changes.cursor, connectionId);
}
export function upsertTransactions(sql: SqlStorage, transactions: Transaction[]): void {
  for (const transaction of transactions) {
    sql.exec(
      `INSERT INTO transactions(id, account_id, date, pending, payload) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET date = excluded.date, pending = excluded.pending, payload = excluded.payload`,
      transaction.id,
      transaction.account_id,
      transaction.date,
      Number(transaction.pending),
      JSON.stringify(transaction),
    );
  }
}
export function replaceInvestmentActivity(
  sql: SqlStorage,
  connectionId: string,
  transactions: Transaction[],
  startDate: string,
  endDate: string,
): void {
  sql.exec(
    `DELETE FROM transactions WHERE account_id IN (SELECT id FROM accounts WHERE connection_id = ?)
    AND json_extract(payload, '$.kind') = 'investment' AND date >= ? AND date <= ?`,
    connectionId,
    startDate,
    endDate,
  );
  upsertTransactions(sql, transactions);
}
export function listStoredTransactions(sql: SqlStorage, query: Query) {
  const rows = sql
    .exec<{
      payload: string;
    }>(
      `SELECT payload FROM transactions
    WHERE (? IS NULL OR account_id = ?) AND date >= ? AND date <= ?
    ORDER BY date DESC, id LIMIT ? OFFSET ?`,
      query.account_id ?? null,
      query.account_id ?? null,
      query.start_date ?? "0000-01-01",
      query.end_date ?? "9999-12-31",
      query.limit,
      query.offset,
    )
    .toArray();
  return rows.map((row) => TransactionSchema.parse(JSON.parse(row.payload)));
}
