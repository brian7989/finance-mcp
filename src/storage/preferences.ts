import { eq } from "drizzle-orm";
import type { Preference } from "../finance/schemas.js";
import { resolveStoredAccountId } from "./accounts.js";
import type { FinanceDatabase } from "./database.js";
import { accounts, preferences } from "./schema.js";

export function listPreferences(db: FinanceDatabase): Preference[] {
  return db
    .select({
      payload: preferences.payload,
    })
    .from(preferences)
    .orderBy(preferences.account_id)
    .all()
    .map((row) => row.payload);
}
export function savePreference(db: FinanceDatabase, preference: Preference): void {
  const id = resolveStoredAccountId(db, preference.account_id);
  if (
    !db
      .select({
        id: accounts.id,
      })
      .from(accounts)
      .where(eq(accounts.id, id))
      .get()
  ) {
    throw new Error("Unknown account");
  }
  const payload = {
    ...preference,
    account_id: id,
  };
  db.insert(preferences)
    .values({
      account_id: id,
      payload,
    })
    .onConflictDoUpdate({
      target: preferences.account_id,
      set: {
        payload,
      },
    })
    .run();
}
