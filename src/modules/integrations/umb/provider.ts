import { AuthenticationError } from "../../../common/errors.js";
import { decryptCredential, encryptCredential } from "../../../common/utils/encryption.js";
import {
  assertConnectionRevision,
  readEncryptedCredential,
  updateCredential,
} from "../../../database/repositories/connections.js";
import type { FinanceContext } from "../../finance/context.js";
import type { Connection } from "../../finance/schemas.js";
import type { FinanceProvider } from "../provider.js";
import { UmbClient } from "./client.js";
import { readUmbSnapshot } from "./readers/accounts.js";
import { readUmbTransactions } from "./readers/transactions.js";
import { UmbAccountsSchema } from "./schemas.js";

export async function resolveUmbProvider(
  context: FinanceContext,
  connection: Connection,
): Promise<FinanceProvider> {
  const cookies = await decryptCredential(
    context.env,
    connection.id,
    readEncryptedCredential(context.db, connection.id),
  );
  const client = new UmbClient(cookies);
  async function readAndSave<T>(action: () => Promise<T>): Promise<T> {
    const result = await action();
    const encrypted = await encryptCredential(context.env, connection.id, client.serialize());
    context.storage.transactionSync(() => {
      assertConnectionRevision(context.db, connection);
      updateCredential(context.db, connection, encrypted);
    });
    return result;
  }
  return {
    readMetadata: () =>
      readAndSave(async () => {
        await client.read("/Accounts/List", UmbAccountsSchema);
        return {
          institution: "UMB HSA",
          capabilities: [
            "balances",
            "transactions",
          ],
        };
      }),
    readSnapshot: (current) => readAndSave(() => readUmbSnapshot(client, current)),
    readChanges: () =>
      readAndSave(async () => ({
        cash: await readUmbTransactions(client),
        investments: null,
      })),
    disconnect: () => endSession(client),
  };
}
async function endSession(client: UmbClient): Promise<void> {
  try {
    const response = await client.authenticate("/Authentication/LogOff");
    await response.body?.cancel();
  } catch (error) {
    if (!(error instanceof AuthenticationError)) {
      throw error;
    }
  }
}
