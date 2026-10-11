import { DurableObject } from "cloudflare:workers";
import * as z from "zod";
import { type Env, ownerSession } from "../config.js";
import { AuthenticationError } from "../errors.js";
import {
  type Connection,
  PreferenceSchema,
  QuerySchema,
  SnapshotSchema,
} from "../finance/schemas.js";
import { createPlaidClient, PlaidError } from "../providers/plaid/client.js";
import { readInvestmentActivity } from "../providers/plaid/investments.js";
import { createHostedLink, exchangeHostedLink, readItemDetails } from "../providers/plaid/link.js";
import { readTransactionChanges } from "../providers/plaid/sync.js";
import { createProvider } from "../providers/registry.js";
import {
  listBalanceHistory,
  listLatestBalances,
  listPreferences,
  listStoredAccounts,
  listStoredHoldings,
  savePreference,
  saveSnapshot,
} from "./accounts.js";
import {
  assertConnectionRevision,
  listStoredConnections,
  readEncryptedCredential,
  readSyncCursor,
  recordFailure,
  recordSuccess,
  requireConnection,
  saveConnection,
} from "./connections.js";
import { decryptCredential, encryptCredential } from "./credentials.js";
import { migrateStorage } from "./migrations.js";
import {
  listStoredTransactions,
  replaceInvestmentActivity,
  saveTransactionChanges,
} from "./transactions.js";

type LinkRow = {
  token: string;
  connection_id: string | null;
  expires_at: number;
};
type SyncResult = {
  connection_id: string;
  ok: boolean;
};

export class FinanceStore extends DurableObject<Env> {
  private syncing = new Map<string, Promise<SyncResult>>();
  private completing = new Map<string, Promise<void>>();

  constructor(context: DurableObjectState, env: Env) {
    super(context, env);
    migrateStorage(context.storage.sql);
  }
  async accounts() {
    return {
      accounts: listStoredAccounts(this.sql),
      preferences: listPreferences(this.sql),
      connections: listStoredConnections(this.sql),
    };
  }
  async balances() {
    return {
      balances: listLatestBalances(this.sql),
      connections: listStoredConnections(this.sql),
    };
  }
  async holdings() {
    return {
      holdings: listStoredHoldings(this.sql),
      connections: listStoredConnections(this.sql),
    };
  }
  async balanceHistory(input: unknown) {
    const query = QuerySchema.parse(input);
    return {
      observations: listBalanceHistory(this.sql, query),
      limit: query.limit,
      offset: query.offset,
    };
  }
  async transactions(input: unknown) {
    const query = QuerySchema.parse(input);
    return {
      transactions: listStoredTransactions(this.sql, query),
      limit: query.limit,
      offset: query.offset,
    };
  }
  async connections() {
    return {
      connections: listStoredConnections(this.sql),
    };
  }
  async setPreference(input: unknown): Promise<void> {
    savePreference(this.sql, PreferenceSchema.parse(input));
  }
  async linkBenepass(): Promise<void> {
    if (!(await ownerSession(this.env).status()).logged_in) {
      throw new Error("Benepass is not signed in");
    }
    saveConnection(
      this.sql,
      newConnection("benepass", "benepass", "Benepass", [
        "balances",
        "holdings",
      ]),
      null,
    );
  }
  async beginPlaidLink(kind: "bank" | "investment", connectionId?: string): Promise<string> {
    z.enum([
      "bank",
      "investment",
    ]).parse(kind);
    z.string()
      .regex(/^[a-f0-9]{64}$/)
      .parse(this.env.DATA_KEY);
    const flowId = crypto.randomUUID();
    const token = connectionId
      ? await this.plaidToken(requireConnection(this.sql, connectionId))
      : undefined;
    const link = await createHostedLink(createPlaidClient(this.env), this.env, flowId, kind, token);
    this.sql.exec("DELETE FROM links WHERE expires_at < ?", Date.now());
    this.sql.exec(
      "INSERT INTO links(id, token, connection_id, expires_at) VALUES (?, ?, ?, ?)",
      flowId,
      link.link_token,
      connectionId ?? null,
      Date.parse(link.expiration),
    );
    return link.hosted_link_url;
  }
  async completePlaidLink(flowId: string): Promise<void> {
    z.uuid().parse(flowId);
    const existing = this.completing.get(flowId);
    if (existing) {
      return existing;
    }
    const pending = this.finishPlaidLink(flowId);
    this.completing.set(flowId, pending);
    try {
      await pending;
    } finally {
      this.completing.delete(flowId);
    }
  }
  async disconnect(connectionId: string): Promise<void> {
    const connection = requireConnection(this.sql, connectionId);
    // Advance the revision before network I/O; in-flight synchronization cannot restore data.
    this.sql.exec(
      "UPDATE connections SET status = 'disconnected', revision = ? WHERE id = ?",
      crypto.randomUUID(),
      connectionId,
    );
    if (connection.provider === "plaid") {
      await this.revokePlaidConnection(connection);
    } else {
      await ownerSession(this.env).logout();
    }
    this.sql.exec(
      "UPDATE connections SET credential = NULL WHERE id = ? AND status = 'disconnected'",
      connectionId,
    );
  }
  async syncConnection(connectionId: string): Promise<SyncResult> {
    const existing = this.syncing.get(connectionId);
    if (existing) {
      return existing;
    }
    const pending = this.refreshConnection(connectionId);
    this.syncing.set(connectionId, pending);
    try {
      return await pending;
    } finally {
      this.syncing.delete(connectionId);
    }
  }
  async scheduleSync(): Promise<void> {
    const ids = listStoredConnections(this.sql)
      .filter((value) => value.status === "connected")
      .map((value) => value.id);
    const pending = (await this.ctx.storage.get<string[]>("sync_queue")) ?? [];
    await this.ctx.storage.put("sync_queue", [
      ...new Set([
        ...pending,
        ...ids,
      ]),
    ]);
    if (ids.length) {
      await this.ctx.storage.setAlarm(Date.now() + 1000);
    }
  }
  async scheduleConnectionSync(connectionId: string): Promise<void> {
    requireConnection(this.sql, connectionId);
    const queue = (await this.ctx.storage.get<string[]>("sync_queue")) ?? [];
    if (!queue.includes(connectionId)) {
      await this.ctx.storage.put("sync_queue", [
        ...queue,
        connectionId,
      ]);
    }
    if ((await this.ctx.storage.getAlarm()) === null) {
      await this.ctx.storage.setAlarm(Date.now() + 1000);
    }
  }
  async alarm(): Promise<void> {
    const queue = (await this.ctx.storage.get<string[]>("sync_queue")) ?? [];
    const next = queue[0];
    if (!next) {
      return;
    }
    // Process one institution per invocation to bound CPU and external requests.
    await this.syncConnection(next);
    const remaining = await this.ctx.storage.transaction(async (storage) => {
      const current = (await storage.get<string[]>("sync_queue")) ?? [];
      const rest = current.filter((id) => id !== next);
      await storage.put("sync_queue", rest);
      return rest;
    });
    if (remaining.length) {
      await this.ctx.storage.setAlarm(Date.now() + 30000);
    }
  }
  private get sql(): SqlStorage {
    return this.ctx.storage.sql;
  }
  private async finishPlaidLink(flowId: string): Promise<void> {
    const flow = this.sql
      .exec<LinkRow>("SELECT token, connection_id, expires_at FROM links WHERE id = ?", flowId)
      .toArray()[0];
    if (!flow || flow.expires_at <= Date.now()) {
      throw new Error("Link expired");
    }
    const client = createPlaidClient(this.env);
    if (flow.connection_id) {
      const previous = requireConnection(this.sql, flow.connection_id);
      const token = await this.plaidToken(previous);
      const details = await readItemDetails(client, token);
      assertConnectionRevision(this.sql, previous);
      this.sql.exec(
        "UPDATE connections SET status = 'connected', capabilities = ?, revision = ? WHERE id = ?",
        JSON.stringify(details.capabilities),
        crypto.randomUUID(),
        previous.id,
      );
    } else {
      const exchanged = await exchangeHostedLink(client, flow.token);
      const id = `plaid/${exchanged.item_id}`;
      const encrypted = await encryptCredential(this.env, id, exchanged.access_token);
      // Persist credentials before metadata requests so an outage cannot lose an exchanged token.
      saveConnection(
        this.sql,
        newConnection(id, "plaid", "Financial institution", [
          "balances",
        ]),
        encrypted,
      );
      this.sql.exec("DELETE FROM links WHERE id = ?", flowId);
      const details = await readItemDetails(client, exchanged.access_token);
      this.sql.exec(
        "UPDATE connections SET institution = ?, capabilities = ? WHERE id = ? AND status != 'disconnected'",
        details.institution,
        JSON.stringify(details.capabilities),
        id,
      );
    }
    this.sql.exec("DELETE FROM links WHERE id = ?", flowId);
    await this.scheduleSync();
  }
  private async refreshConnection(connectionId: string): Promise<SyncResult> {
    const connection = requireConnection(this.sql, connectionId);
    if (connection.status === "disconnected") {
      return {
        connection_id: connectionId,
        ok: false,
      };
    }
    try {
      const token = connection.provider === "plaid" ? await this.plaidToken(connection) : undefined;
      const snapshot = SnapshotSchema.parse(
        await createProvider(this.env, connection, token).readSnapshot(connection),
      );
      assertConnectionRevision(this.sql, connection);
      this.ctx.storage.transactionSync(() => saveSnapshot(this.sql, connectionId, snapshot));
      if (token) {
        await this.syncPlaidTransactions(connection, token);
      }
      assertConnectionRevision(this.sql, connection);
      recordSuccess(this.sql, connectionId);
      return {
        connection_id: connectionId,
        ok: true,
      };
    } catch (error) {
      recordFailure(this.sql, connection, needsReconnection(error));
      return {
        connection_id: connectionId,
        ok: false,
      };
    }
  }
  private async syncPlaidTransactions(connection: Connection, token: string): Promise<void> {
    const client = createPlaidClient(this.env);
    if (connection.capabilities.includes("transactions")) {
      const changes = await readTransactionChanges(
        client,
        token,
        connection.id,
        readSyncCursor(this.sql, connection.id),
      );
      assertConnectionRevision(this.sql, connection);
      this.ctx.storage.transactionSync(() =>
        saveTransactionChanges(this.sql, connection.id, changes),
      );
    }
    if (connection.capabilities.includes("investment_activity")) {
      const transactions = await readInvestmentActivity(client, token, connection.id);
      assertConnectionRevision(this.sql, connection);
      const start = new Date(Date.now() - 730 * 86400000).toISOString().slice(0, 10);
      const end = new Date().toISOString().slice(0, 10);
      this.ctx.storage.transactionSync(() =>
        replaceInvestmentActivity(this.sql, connection.id, transactions, start, end),
      );
    }
  }
  private async plaidToken(connection: Connection): Promise<string> {
    if (connection.provider !== "plaid" || connection.status === "disconnected") {
      throw new Error("Plaid connection is unavailable");
    }
    return decryptCredential(
      this.env,
      connection.id,
      readEncryptedCredential(this.sql, connection.id),
    );
  }
  private async revokePlaidConnection(connection: Connection): Promise<void> {
    const token = await decryptCredential(
      this.env,
      connection.id,
      readEncryptedCredential(this.sql, connection.id),
    );
    await createPlaidClient(this.env)(
      "/item/remove",
      {
        access_token: token,
      },
      z.object({}),
    );
  }
}
function newConnection(
  id: string,
  provider: Connection["provider"],
  institution: string,
  capabilities: Connection["capabilities"],
): Connection {
  return {
    id,
    provider,
    institution,
    capabilities,
    status: "connected",
    revision: crypto.randomUUID(),
    last_success_at: null,
    last_error: null,
  };
}
function needsReconnection(error: unknown): boolean {
  if (error instanceof AuthenticationError) {
    return true;
  }
  return (
    error instanceof PlaidError &&
    [
      "ITEM_LOGIN_REQUIRED",
      "INVALID_ACCESS_TOKEN",
      "ITEM_NOT_FOUND",
    ].includes(error.code)
  );
}
