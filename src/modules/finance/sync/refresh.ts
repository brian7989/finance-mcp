import * as z from "zod";
import { AuthenticationError, errorCode } from "../../../common/errors.js";
import { saveSnapshot } from "../../../database/repositories/accounts.js";
import {
  assertConnectionRevision,
  readSyncCursor,
  recordFailure,
  recordSuccess,
  requireConnection,
  updateConnectionMetadata,
} from "../../../database/repositories/connections.js";
import {
  replaceInvestmentActivity,
  saveTransactionChanges,
} from "../../../database/repositories/transactions.js";
import type { FinanceProvider, LedgerChanges } from "../../integrations/provider.js";
import { resolveProvider } from "../../integrations/registry.js";
import type { FinanceContext } from "../context.js";
import { type Connection, type Snapshot, SnapshotSchema } from "../schemas.js";

export type SyncResult = {
  connection_id: string;
  ok: boolean;
};

export async function refreshConnection(context: FinanceContext, id: string): Promise<SyncResult> {
  const connection = requireConnection(context.db, id);
  if (connection.status === "disconnected") {
    return syncResult(id, false);
  }
  try {
    await refreshProviderData(context, connection);
    return syncResult(id, true);
  } catch (error) {
    reportSyncFailure(error);
    recordFailure(context.db, connection, error instanceof AuthenticationError);
    return syncResult(id, false);
  }
}
async function refreshProviderData(context: FinanceContext, original: Connection): Promise<void> {
  const provider = await resolveProvider(context, original);
  const connection = await refreshMetadata(context, provider, original);
  const snapshot = SnapshotSchema.parse(await provider.readSnapshot(connection));
  saveSnapshotIfUnchanged(context, connection, snapshot);
  const changes = await readLedgerChanges(context, provider, connection);
  commitChangesAndRecordSuccess(context, connection, changes);
}
async function refreshMetadata(
  context: FinanceContext,
  provider: FinanceProvider,
  connection: Connection,
): Promise<Connection> {
  const metadata = await provider.readMetadata();
  return updateConnectionMetadata(context.db, connection, metadata);
}
function saveSnapshotIfUnchanged(
  context: FinanceContext,
  connection: Connection,
  snapshot: Snapshot,
): void {
  context.storage.transactionSync(() => {
    assertConnectionRevision(context.db, connection);
    saveSnapshot(context.db, connection.id, snapshot);
  });
}
async function readLedgerChanges(
  context: FinanceContext,
  provider: FinanceProvider,
  connection: Connection,
): Promise<LedgerChanges> {
  const cursor = readSyncCursor(context.db, connection.id);
  return provider.readChanges(connection, cursor);
}
function commitChangesAndRecordSuccess(
  context: FinanceContext,
  connection: Connection,
  changes: LedgerChanges,
): void {
  context.storage.transactionSync(() => {
    assertConnectionRevision(context.db, connection);
    saveBankingChanges(context, connection, changes);
    saveInvestmentChanges(context, connection, changes);
    recordSuccess(context.db, connection.id);
  });
}
function saveBankingChanges(
  context: FinanceContext,
  connection: Connection,
  changes: LedgerChanges,
): void {
  if (!changes.cash) {
    return;
  }
  saveTransactionChanges(context.db, connection.id, changes.cash);
}
function saveInvestmentChanges(
  context: FinanceContext,
  connection: Connection,
  changes: LedgerChanges,
): void {
  const activity = changes.investments;
  if (!activity) {
    return;
  }
  replaceInvestmentActivity(
    context.db,
    connection.id,
    activity.transactions,
    activity.start_date,
    activity.end_date,
  );
}
function syncResult(id: string, ok: boolean): SyncResult {
  return {
    connection_id: id,
    ok,
  };
}

function reportSyncFailure(error: unknown): void {
  const details =
    error instanceof z.ZodError
      ? error.issues.map(({ code, path }) => ({
          code,
          path,
        }))
      : (errorCode(error) ?? "UNEXPECTED_ERROR");
  console.error("finance-mcp: sync failed", details);
}
