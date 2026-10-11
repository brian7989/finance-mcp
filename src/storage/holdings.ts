import { eq, inArray } from "drizzle-orm";
import type { Holding } from "../finance/schemas.js";
import type { FinanceDatabase } from "./database.js";
import { accounts, holdings } from "./schema.js";

export function listStoredHoldings(db: FinanceDatabase): Holding[] {
  return db
    .select({
      payload: holdings.payload,
    })
    .from(holdings)
    .orderBy(holdings.account_id, holdings.id)
    .all()
    .map((row) => row.payload);
}
export function replaceHoldings(
  db: FinanceDatabase,
  connectionId: string,
  values: Holding[],
): void {
  const selected = db
    .select({
      id: accounts.id,
    })
    .from(accounts)
    .where(eq(accounts.connection_id, connectionId));
  db.delete(holdings).where(inArray(holdings.account_id, selected)).run();
  for (const holding of values) {
    db.insert(holdings)
      .values({
        account_id: holding.account_id,
        id: holding.id,
        payload: holding,
      })
      .run();
  }
}
