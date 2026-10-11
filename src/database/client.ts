import { drizzle } from "drizzle-orm/durable-sqlite";
import * as schema from "./schema.js";

export function createDatabase(storage: DurableObjectStorage) {
  return drizzle(storage, {
    schema,
    logger: false,
  });
}
export type FinanceDatabase = ReturnType<typeof createDatabase>;
