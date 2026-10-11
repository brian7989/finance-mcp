import { decryptCredential } from "../../../common/utils/encryption.js";
import type { FinanceContext } from "../../../database/context.js";
import { readEncryptedCredential } from "../../../database/repositories/connections.js";
import type { Connection } from "../schemas.js";

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
