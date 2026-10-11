import type { Env } from "../config.js";
import type { FinanceDatabase } from "./database.js";

export type FinanceContext = {
  env: Env;
  storage: DurableObjectStorage;
  db: FinanceDatabase;
};
