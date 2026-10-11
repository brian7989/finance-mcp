import { DurableObject } from "cloudflare:workers";
import type { Env } from "../config.js";
import { disconnectConnection } from "../connections/disconnect.js";
import { beginPlaidLink, completePlaidLink, linkBenepass } from "../connections/link.js";
import { summarizeNetWorth } from "../finance/queries.js";
import { PreferenceSchema, QuerySchema } from "../finance/schemas.js";
import { refreshConnection, type SyncResult } from "../sync/refresh.js";
import {
  processNextConnection,
  scheduleAllConnections,
  scheduleConnection,
} from "../sync/scheduling.js";
import { listStoredAccounts } from "./accounts.js";
import { listBalanceHistory, listLatestBalances } from "./balances.js";
import { listStoredConnections } from "./connections.js";
import type { FinanceContext } from "./context.js";
import { createDatabase } from "./database.js";
import { listStoredHoldings } from "./holdings.js";
import { migrateStorage } from "./migrations.js";
import { listPreferences, savePreference } from "./preferences.js";
import { listStoredTransactions } from "./transactions.js";

export class FinanceStore extends DurableObject<Env> {
  private readonly context: FinanceContext;
  private readonly syncing = new Map<string, Promise<SyncResult>>();
  private readonly completing = new Map<string, Promise<void>>();

  constructor(context: DurableObjectState, env: Env) {
    super(context, env);
    const db = createDatabase(context.storage);
    this.context = {
      db,
      storage: context.storage,
      env,
    };
    context.blockConcurrencyWhile(() => migrateStorage(db));
  }
  async accounts() {
    const db = this.context.db;
    return {
      accounts: listStoredAccounts(db),
      preferences: listPreferences(db),
      connections: listStoredConnections(db),
    };
  }
  async netWorth() {
    const db = this.context.db;
    return summarizeNetWorth(
      listStoredAccounts(db),
      listLatestBalances(db),
      listPreferences(db),
      listStoredConnections(db),
    );
  }
  async balances() {
    return {
      balances: listLatestBalances(this.context.db),
      connections: listStoredConnections(this.context.db),
    };
  }
  async holdings() {
    return {
      holdings: listStoredHoldings(this.context.db),
      connections: listStoredConnections(this.context.db),
    };
  }
  async balanceHistory(input: unknown) {
    const query = QuerySchema.parse(input);
    return {
      observations: listBalanceHistory(this.context.db, query),
      limit: query.limit,
      offset: query.offset,
    };
  }
  async transactions(input: unknown) {
    const query = QuerySchema.parse(input);
    return {
      transactions: listStoredTransactions(this.context.db, query),
      limit: query.limit,
      offset: query.offset,
    };
  }
  async connections() {
    return {
      connections: listStoredConnections(this.context.db),
    };
  }
  async setPreference(input: unknown): Promise<void> {
    savePreference(this.context.db, PreferenceSchema.parse(input));
  }
  async linkBenepass(): Promise<void> {
    await linkBenepass(this.context);
  }
  async beginPlaidLink(kind: "bank" | "investment", connectionId?: string): Promise<string> {
    return beginPlaidLink(this.context, kind, connectionId);
  }
  async completePlaidLink(id: string): Promise<void> {
    return coalesce(this.completing, id, async () => {
      await completePlaidLink(this.context, id);
      await this.scheduleSync();
    });
  }
  async disconnect(id: string): Promise<void> {
    await disconnectConnection(this.context, id);
  }
  async syncConnection(id: string): Promise<SyncResult> {
    return coalesce(this.syncing, id, () => refreshConnection(this.context, id));
  }
  async scheduleSync(): Promise<void> {
    await scheduleAllConnections(this.context);
  }
  async scheduleConnectionSync(id: string): Promise<void> {
    await scheduleConnection(this.context, id);
  }
  async alarm(): Promise<void> {
    await processNextConnection(this.context, (id) => this.syncConnection(id));
  }
}
async function coalesce<T>(
  pending: Map<string, Promise<T>>,
  id: string,
  action: () => Promise<T>,
): Promise<T> {
  const existing = pending.get(id);
  if (existing) {
    return existing;
  }
  const operation = action();
  pending.set(id, operation);
  try {
    return await operation;
  } finally {
    pending.delete(id);
  }
}
