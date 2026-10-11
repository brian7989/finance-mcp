import { eq } from "drizzle-orm";
import type { Account, Snapshot } from "../../modules/finance/schemas.js";
import type { FinanceDatabase } from "../client.js";
import { accountAliases, accounts } from "../schema.js";
import { saveBalanceObservation } from "./balances.js";
import { replaceHoldings } from "./holdings.js";

export function saveSnapshot(db: FinanceDatabase, connectionId: string, snapshot: Snapshot): void {
  const ids = reconcileAccountIds(db, snapshot);
  deactivateConnectionAccounts(db, connectionId);
  saveAccountSnapshots(db, connectionId, snapshot, ids);
  saveMappedBalances(db, snapshot, ids);
  saveMappedHoldings(db, connectionId, snapshot, ids);
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
function saveAccountSnapshots(
  db: FinanceDatabase,
  connectionId: string,
  snapshot: Snapshot,
  ids: Map<string, string>,
): void {
  for (const account of snapshot.accounts) {
    saveAccount(db, connectionId, {
      ...account,
      id: requireMappedId(ids, account.id),
    });
  }
}
function saveAccount(db: FinanceDatabase, connectionId: string, payload: Account): void {
  db.insert(accounts)
    .values({
      id: payload.id,
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
function saveMappedBalances(
  db: FinanceDatabase,
  snapshot: Snapshot,
  ids: Map<string, string>,
): void {
  for (const balance of snapshot.balances) {
    saveBalanceObservation(db, {
      ...balance,
      account_id: requireMappedId(ids, balance.account_id),
    });
  }
}
function saveMappedHoldings(
  db: FinanceDatabase,
  connectionId: string,
  snapshot: Snapshot,
  ids: Map<string, string>,
): void {
  if (snapshot.holdings === null) {
    return;
  }
  const values = snapshot.holdings.map((holding) => ({
    ...holding,
    account_id: requireMappedId(ids, holding.account_id),
  }));
  replaceHoldings(db, connectionId, values);
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
