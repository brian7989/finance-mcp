import type { Env } from "../config/env.js";
import type { FinanceDatabase } from "./client.js";

export type FinanceContext = {
  env: Env;
  storage: DurableObjectStorage;
  db: FinanceDatabase;
};
