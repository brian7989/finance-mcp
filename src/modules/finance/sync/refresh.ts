import { AuthenticationError } from "../../../common/errors.js";
import type { FinanceContext } from "../../../database/context.js";
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
import { PlaidError } from "../../integrations/plaid/client.js";
import { createProvider } from "../../integrations/registry.js";
import { providerCredential } from "../connections/credentials.js";
import type { Connection } from "../schemas.js";
import { SnapshotSchema } from "../schemas.js";

export type SyncResult = {
  connection_id: string;
  ok: boolean;
};

export async function refreshConnection(context: FinanceContext, id: string): Promise<SyncResult> {
  const original = requireConnection(context.db, id);
  if (original.status === "disconnected") {
    return {
      connection_id: id,
      ok: false,
    };
  }
  try {
    await refreshProviderData(context, original);
    return {
      connection_id: id,
      ok: true,
    };
  } catch (error) {
    recordFailure(context.db, original, needsReconnection(error));
    return {
      connection_id: id,
      ok: false,
    };
  }
}
async function refreshProviderData(context: FinanceContext, original: Connection): Promise<void> {
  const credential = await providerCredential(context, original);
  const provider = createProvider(context.env, original, credential);
  const details = await provider.readMetadata();
  const connection = updateConnectionMetadata(context.db, original, details);
  const snapshot = SnapshotSchema.parse(await provider.readSnapshot(connection));
  assertConnectionRevision(context.db, connection);
  context.storage.transactionSync(() => saveSnapshot(context.db, connection.id, snapshot));
  const changes = await provider.readChanges(connection, readSyncCursor(context.db, connection.id));
  assertConnectionRevision(context.db, connection);
  context.storage.transactionSync(() => {
    if (changes.cash) {
      saveTransactionChanges(context.db, connection.id, changes.cash);
    }
    if (changes.investments) {
      const activity = changes.investments;
      replaceInvestmentActivity(
        context.db,
        connection.id,
        activity.transactions,
        activity.start_date,
        activity.end_date,
      );
    }
    recordSuccess(context.db, connection.id);
  });
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
