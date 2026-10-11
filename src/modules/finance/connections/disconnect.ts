import { deactivateConnectionAccounts } from "../../../database/repositories/accounts.js";
import {
  clearCredential,
  hasStoredCredential,
  markDisconnected,
  requireConnection,
} from "../../../database/repositories/connections.js";
import { resolveProvider } from "../../integrations/registry.js";
import type { FinanceContext } from "../context.js";
import type { Connection } from "../schemas.js";

export async function disconnectConnection(context: FinanceContext, id: string): Promise<void> {
  const connection = requireConnection(context.db, id);
  if (isFullyDisconnected(context, connection)) {
    return;
  }
  const provider = await resolveProvider(context, connection);
  const revision = deactivateConnection(context, connection);
  await provider.disconnect();
  clearCredential(context.db, id, revision);
}
function isFullyDisconnected(context: FinanceContext, connection: Connection): boolean {
  return (
    connection.status === "disconnected" &&
    connection.last_error === null &&
    !hasStoredCredential(context.db, connection.id)
  );
}
function deactivateConnection(context: FinanceContext, connection: Connection): string {
  return context.storage.transactionSync(() => {
    assertUnchangedConnection(context, connection);
    deactivateConnectionAccounts(context.db, connection.id);
    return markDisconnected(context.db, connection.id);
  });
}

function assertUnchangedConnection(context: FinanceContext, expected: Connection): void {
  const current = requireConnection(context.db, expected.id);
  if (current.revision !== expected.revision) {
    throw new Error("Connection changed during operation");
  }
}
