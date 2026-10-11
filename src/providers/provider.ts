import type { Connection, Snapshot } from "../finance/schemas.js";

export interface FinanceProvider {
  readSnapshot(connection: Connection): Promise<Snapshot>;
}
