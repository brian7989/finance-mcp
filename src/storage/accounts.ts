import { eq } from "drizzle-orm";
import type { Snapshot } from "../finance/schemas.js";
import { saveBalanceObservation } from "./balances.js";
import type { FinanceDatabase } from "./database.js";
import { replaceHoldings } from "./holdings.js";
import { accountAliases, accounts } from "./schema.js";

export function saveSnapshot(db: FinanceDatabase, connectionId: string, snapshot: Snapshot): void {
  const ids = reconcileAccountIds(db, snapshot);
  db.update(accounts)
    .set({
      active: false,
    })
    .where(eq(accounts.connection_id, connectionId))
    .run();
  for (const account of snapshot.accounts) {
    const id = requireMappedId(ids, account.id);
    const payload = {
      ...account,
      id,
    };
    db.insert(accounts)
      .values({
        id,
        connection_id: connectionId,
        payload,
        active: true,
      })
      .onConflictDoUpdate({
        target: accounts.id,
        set: {
          payload,
          active: true,
        },
      })
      .run();
  }
  for (const balance of snapshot.balances) {
    saveBalanceObservation(db, {
      ...balance,
      account_id: requireMappedId(ids, balance.account_id),
    });
  }
  if (snapshot.holdings !== null) {
    replaceHoldings(
      db,
      connectionId,
      snapshot.holdings.map((holding) => ({
        ...holding,
        account_id: requireMappedId(ids, holding.account_id),
      })),
    );
  }
}

export function listStoredAccounts(db: FinanceDatabase) {
  return db
    .select()
    .from(accounts)
    .orderBy(accounts.id)
    .all()
    .map((row) => ({
      ...row.payload,
      active: row.active,
    }));
}

export function deactivateConnectionAccounts(db: FinanceDatabase, connectionId: string): void {
  db.update(accounts)
    .set({
      active: false,
    })
    .where(eq(accounts.connection_id, connectionId))
    .run();
}
export function resolveStoredAccountId(db: FinanceDatabase, providerId: string): string {
  return (
    db.select().from(accountAliases).where(eq(accountAliases.provider_id, providerId)).get()
      ?.account_id ?? providerId
  );
}
function reconcileAccountIds(db: FinanceDatabase, snapshot: Snapshot): Map<string, string> {
  const ids = new Map<string, string>();
  const stored = listStoredAccounts(db);
  for (const account of snapshot.accounts) {
    const previous = stored.find(
      (value) =>
        value.connection_id === account.connection_id &&
        value.provider_account_id === account.provider_account_id,
    );
    const id = previous?.id ?? crypto.randomUUID();
    ids.set(account.id, id);
    db.insert(accountAliases)
      .values({
        provider_id: account.id,
        account_id: id,
      })
      .onConflictDoUpdate({
        target: accountAliases.provider_id,
        set: {
          account_id: id,
        },
      })
      .run();
  }
  return ids;
}

function requireMappedId(ids: Map<string, string>, providerId: string): string {
  const id = ids.get(providerId);
  if (!id) {
    throw new Error("Provider referenced an unknown account");
  }
  return id;
}
