import { DurableObject } from "cloudflare:workers";
import type { Env } from "../config/env.js";
import { disconnectConnection } from "../modules/finance/connections/disconnect.js";
import {
  beginPlaidLink,
  completePlaidLink,
  linkBenepass,
} from "../modules/finance/connections/link.js";
import type { FinanceContext } from "../modules/finance/context.js";
import { PreferenceSchema, QuerySchema } from "../modules/finance/schemas.js";
import { summarizeNetWorth } from "../modules/finance/services/queries.js";
import { refreshConnection, type SyncResult } from "../modules/finance/sync/refresh.js";
import {
  processNextConnection,
  scheduleAllConnections,
  scheduleConnection,
} from "../modules/finance/sync/scheduling.js";
import { createDatabase } from "./client.js";
import { migrateStorage } from "./migrations.js";
import { listStoredAccounts } from "./repositories/accounts.js";
import { listBalanceHistory, listLatestBalances } from "./repositories/balances.js";
import { listStoredConnections } from "./repositories/connections.js";
import { listStoredHoldings } from "./repositories/holdings.js";
import { listPreferences, savePreference } from "./repositories/preferences.js";
import { listStoredTransactions } from "./repositories/transactions.js";

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
  async beginPlaidLink(connectionId?: string): Promise<string> {
    return beginPlaidLink(this.context, connectionId);
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
