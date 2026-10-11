import { migrate } from "drizzle-orm/durable-sqlite/migrator";
import type { FinanceDatabase } from "./database.js";
import initial from "./migrations/0000_initial.sql";
import journal from "./migrations/meta/_journal.json";

export async function migrateStorage(db: FinanceDatabase): Promise<void> {
  await migrate(db, {
    journal,
    migrations: {
      m0000: initial,
    },
  });
}
