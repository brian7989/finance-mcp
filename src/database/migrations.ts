import { migrate } from "drizzle-orm/durable-sqlite/migrator";
import type { FinanceDatabase } from "./client.js";
import initial from "./migrations/0000_initial.sql";
import removeCombinedHsa from "./migrations/0001_remove_combined_hsa.sql";
import journal from "./migrations/meta/_journal.json";

export async function migrateStorage(db: FinanceDatabase): Promise<void> {
  await migrate(db, {
    journal,
    migrations: {
      m0000: initial,
      m0001: removeCombinedHsa,
    },
  });
}
