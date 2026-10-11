import type { Connection } from "../finance/schemas.js";
import { readEncryptedCredential } from "../storage/connections.js";
import type { FinanceContext } from "../storage/context.js";
import { decryptCredential } from "../storage/credentials.js";

export async function providerCredential(
  context: FinanceContext,
  connection: Connection,
): Promise<string | undefined> {
  if (connection.provider === "benepass") {
    return undefined;
  }
  if (connection.status === "disconnected") {
    throw new Error("Connection is disconnected");
  }
  return decryptCredential(
    context.env,
    connection.id,
    readEncryptedCredential(context.db, connection.id),
  );
}
