import * as sqlite from "drizzle-orm/sqlite-core";
import type {
  Account,
  Balance,
  Capability,
  Connection,
  Holding,
  Preference,
  Transaction,
} from "../finance/schemas.js";

export const connections = sqlite.sqliteTable("connections", {
  id: sqlite.text().primaryKey(),
  provider: sqlite.text().$type<Connection["provider"]>().notNull(),
  institution: sqlite.text().notNull(),
  status: sqlite.text().$type<Connection["status"]>().notNull(),
  capabilities: sqlite
    .text({
      mode: "json",
    })
    .$type<Capability[]>()
    .notNull(),
  credential: sqlite.text(),
  revision: sqlite.text().notNull(),
  last_success_at: sqlite.text(),
  last_error: sqlite.text(),
  cursor: sqlite.text(),
});
export const accounts = sqlite.sqliteTable(
  "accounts",
  {
    id: sqlite.text().primaryKey(),
    connection_id: sqlite.text().notNull(),
    payload: sqlite
      .text({
        mode: "json",
      })
      .$type<Account>()
      .notNull(),
    active: sqlite
      .integer({
        mode: "boolean",
      })
      .notNull()
      .default(true),
  },
  (table) => [
    sqlite.index("accounts_connection").on(table.connection_id),
  ],
);
export const preferences = sqlite.sqliteTable("preferences", {
  account_id: sqlite.text().primaryKey(),
  payload: sqlite
    .text({
      mode: "json",
    })
    .$type<Preference>()
    .notNull(),
});
export const balances = sqlite.sqliteTable(
  "balances",
  {
    account_id: sqlite.text().notNull(),
    day: sqlite.text().notNull(),
    payload: sqlite
      .text({
        mode: "json",
      })
      .$type<Balance>()
      .notNull(),
  },
  (table) => [
    sqlite.primaryKey({
      columns: [
        table.account_id,
        table.day,
      ],
    }),
    sqlite.index("balances_day").on(table.day, table.account_id),
  ],
);
export const holdings = sqlite.sqliteTable(
  "holdings",
  {
    account_id: sqlite.text().notNull(),
    id: sqlite.text().notNull(),
    payload: sqlite
      .text({
        mode: "json",
      })
      .$type<Holding>()
      .notNull(),
  },
  (table) => [
    sqlite.primaryKey({
      columns: [
        table.account_id,
        table.id,
      ],
    }),
  ],
);
export const transactions = sqlite.sqliteTable(
  "transactions",
  {
    id: sqlite.text().primaryKey(),
    account_id: sqlite.text().notNull(),
    date: sqlite.text().notNull(),
    pending: sqlite
      .integer({
        mode: "boolean",
      })
      .notNull(),
    payload: sqlite
      .text({
        mode: "json",
      })
      .$type<Transaction>()
      .notNull(),
  },
  (table) => [
    sqlite.index("transactions_account_date").on(table.account_id, table.date),
    sqlite.index("transactions_date").on(table.date, table.id),
  ],
);
export const links = sqlite.sqliteTable("links", {
  id: sqlite.text().primaryKey(),
  token: sqlite.text().notNull(),
  connection_id: sqlite.text(),
  expires_at: sqlite.integer().notNull(),
});
export const accountAliases = sqlite.sqliteTable("account_aliases", {
  provider_id: sqlite.text().primaryKey(),
  account_id: sqlite.text().notNull(),
});
export const syncJobs = sqlite.sqliteTable("sync_jobs", {
  connection_id: sqlite.text().primaryKey(),
  generation: sqlite.integer().notNull().default(1),
});
