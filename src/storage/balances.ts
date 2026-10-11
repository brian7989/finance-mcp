import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import type { Balance, Query } from "../finance/schemas.js";
import type { FinanceDatabase } from "./database.js";
import { balances } from "./schema.js";

export function saveBalanceObservation(db: FinanceDatabase, balance: Balance): void {
  const value = {
    account_id: balance.account_id,
    day: balance.fetched_at.slice(0, 10),
    payload: balance,
  };
  db.insert(balances)
    .values(value)
    .onConflictDoUpdate({
      target: [
        balances.account_id,
        balances.day,
      ],
      set: {
        payload: balance,
      },
    })
    .run();
}
export function listLatestBalances(db: FinanceDatabase): Balance[] {
  const latest = db
    .select({
      account_id: balances.account_id,
      day: sql<string>`max(${balances.day})`.as("latest_day"),
    })
    .from(balances)
    .groupBy(balances.account_id)
    .as("latest");
  return db
    .select({
      payload: balances.payload,
    })
    .from(balances)
    .innerJoin(
      latest,
      and(eq(balances.account_id, latest.account_id), eq(balances.day, latest.day)),
    )
    .orderBy(balances.account_id)
    .all()
    .map((row) => row.payload);
}
export function listBalanceHistory(db: FinanceDatabase, query: Query): Balance[] {
  return db
    .select({
      payload: balances.payload,
    })
    .from(balances)
    .where(
      and(
        query.account_id ? eq(balances.account_id, query.account_id) : undefined,
        query.start_date ? gte(balances.day, query.start_date) : undefined,
        query.end_date ? lte(balances.day, query.end_date) : undefined,
      ),
    )
    .orderBy(desc(balances.day), balances.account_id)
    .limit(query.limit)
    .offset(query.offset)
    .all()
    .map((row) => row.payload);
}
