import {
  AccountSchema,
  BalanceSchema,
  HoldingSchema,
  type Preference,
  PreferenceSchema,
  type Query,
  type Snapshot,
} from "../finance/schemas.js";

export function saveSnapshot(sql: SqlStorage, connectionId: string, snapshot: Snapshot): void {
  sql.exec("UPDATE accounts SET active = 0 WHERE connection_id = ?", connectionId);
  for (const account of snapshot.accounts) {
    sql.exec(
      "INSERT INTO accounts(id, connection_id, payload, active) VALUES (?, ?, ?, 1) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, active = 1",
      account.id,
      connectionId,
      JSON.stringify(account),
    );
  }
  for (const balance of snapshot.balances) {
    sql.exec(
      "INSERT INTO balances(account_id, day, payload) VALUES (?, ?, ?) ON CONFLICT(account_id, day) DO UPDATE SET payload = excluded.payload",
      balance.account_id,
      balance.fetched_at.slice(0, 10),
      JSON.stringify(balance),
    );
  }
  if (snapshot.holdings !== null) {
    sql.exec(
      "DELETE FROM holdings WHERE account_id IN (SELECT id FROM accounts WHERE connection_id = ?)",
      connectionId,
    );
    for (const holding of snapshot.holdings) {
      sql.exec(
        "INSERT INTO holdings(account_id, id, payload) VALUES (?, ?, ?)",
        holding.account_id,
        holding.id,
        JSON.stringify(holding),
      );
    }
  }
}
export function listStoredAccounts(sql: SqlStorage) {
  return sql
    .exec<{
      payload: string;
      active: number;
    }>("SELECT payload, active FROM accounts ORDER BY id")
    .toArray()
    .map((row) =>
      AccountSchema.parse({
        ...JSON.parse(row.payload),
        active: row.active === 1,
      }),
    );
}
export function listLatestBalances(sql: SqlStorage) {
  const rows = sql
    .exec<{
      payload: string;
    }>(`SELECT b.payload FROM balances b
    JOIN (SELECT account_id, MAX(day) AS day FROM balances GROUP BY account_id) latest
    ON b.account_id = latest.account_id AND b.day = latest.day ORDER BY b.account_id`)
    .toArray();
  return rows.map((row) => BalanceSchema.parse(JSON.parse(row.payload)));
}
export function listBalanceHistory(sql: SqlStorage, query: Query) {
  const rows = sql
    .exec<{
      payload: string;
    }>(
      `SELECT payload FROM balances
    WHERE (? IS NULL OR account_id = ?) AND day >= ? AND day <= ?
    ORDER BY day DESC, account_id LIMIT ? OFFSET ?`,
      query.account_id ?? null,
      query.account_id ?? null,
      query.start_date ?? "0000-01-01",
      query.end_date ?? "9999-12-31",
      query.limit,
      query.offset,
    )
    .toArray();
  return rows.map((row) => BalanceSchema.parse(JSON.parse(row.payload)));
}
export function listStoredHoldings(sql: SqlStorage) {
  return sql
    .exec<{
      payload: string;
    }>("SELECT payload FROM holdings ORDER BY account_id, id")
    .toArray()
    .map((row) => HoldingSchema.parse(JSON.parse(row.payload)));
}
export function listPreferences(sql: SqlStorage): Preference[] {
  return sql
    .exec<{
      payload: string;
    }>("SELECT payload FROM preferences ORDER BY account_id")
    .toArray()
    .map((row) => PreferenceSchema.parse(JSON.parse(row.payload)));
}
export function savePreference(sql: SqlStorage, preference: Preference): void {
  if (!sql.exec("SELECT id FROM accounts WHERE id = ?", preference.account_id).toArray().length) {
    throw new Error("Unknown account");
  }
  sql.exec(
    "INSERT INTO preferences(account_id, payload) VALUES (?, ?) ON CONFLICT(account_id) DO UPDATE SET payload = excluded.payload",
    preference.account_id,
    JSON.stringify(preference),
  );
}
