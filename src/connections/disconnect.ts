import { createProvider } from "../providers/registry.js";
import { deactivateConnectionAccounts } from "../storage/accounts.js";
import {
  clearCredential,
  hasStoredCredential,
  markDisconnected,
  readEncryptedCredential,
  requireConnection,
} from "../storage/connections.js";
import type { FinanceContext } from "../storage/context.js";
import { decryptCredential } from "../storage/credentials.js";

export async function disconnectConnection(context: FinanceContext, id: string): Promise<void> {
  const connection = requireConnection(context.db, id);
  if (connection.status === "disconnected" && !hasStoredCredential(context.db, id)) {
    return;
  }
  const credential =
    connection.provider === "plaid"
      ? await decryptCredential(context.env, id, readEncryptedCredential(context.db, id))
      : undefined;
  const revision = context.storage.transactionSync(() => {
    deactivateConnectionAccounts(context.db, id);
    return markDisconnected(context.db, id);
  });
  await createProvider(context.env, connection, credential).disconnect();
  clearCredential(context.db, id, revision);
}
