import { decryptCredential } from "../../../common/utils/encryption.js";
import type { FinanceContext } from "../../../database/context.js";
import { deactivateConnectionAccounts } from "../../../database/repositories/accounts.js";
import {
  clearCredential,
  hasStoredCredential,
  markDisconnected,
  readEncryptedCredential,
  requireConnection,
} from "../../../database/repositories/connections.js";
import { createProvider } from "../../integrations/registry.js";

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
