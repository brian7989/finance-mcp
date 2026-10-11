export function migrateStorage(sql: SqlStorage): void {
  sql.exec(`
    CREATE TABLE IF NOT EXISTS connections (
      id TEXT PRIMARY KEY, provider TEXT NOT NULL, institution TEXT NOT NULL,
      status TEXT NOT NULL, capabilities TEXT NOT NULL, credential TEXT,
      revision TEXT NOT NULL, last_success_at TEXT, last_error TEXT, cursor TEXT
    );
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY, connection_id TEXT NOT NULL, payload TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1
    );
    CREATE INDEX IF NOT EXISTS accounts_connection ON accounts(connection_id);
    CREATE TABLE IF NOT EXISTS preferences (
      account_id TEXT PRIMARY KEY, payload TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS balances (
      account_id TEXT NOT NULL, day TEXT NOT NULL, payload TEXT NOT NULL,
      PRIMARY KEY (account_id, day)
    );
    CREATE INDEX IF NOT EXISTS balances_day ON balances(day, account_id);
    CREATE TABLE IF NOT EXISTS holdings (
      account_id TEXT NOT NULL, id TEXT NOT NULL, payload TEXT NOT NULL,
      PRIMARY KEY (account_id, id)
    );
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY, account_id TEXT NOT NULL, date TEXT NOT NULL,
      pending INTEGER NOT NULL, payload TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS transactions_account_date ON transactions(account_id, date);
    CREATE INDEX IF NOT EXISTS transactions_date ON transactions(date, id);
    CREATE TABLE IF NOT EXISTS links (
      id TEXT PRIMARY KEY, token TEXT NOT NULL, connection_id TEXT, expires_at INTEGER NOT NULL
    );
  `);
}
