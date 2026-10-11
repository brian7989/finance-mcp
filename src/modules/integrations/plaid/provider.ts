import * as z from "zod";
import { AuthenticationError } from "../../../common/errors.js";
import { decryptCredential } from "../../../common/utils/encryption.js";
import type { Env } from "../../../config/env.js";
import { readEncryptedCredential } from "../../../database/repositories/connections.js";
import type { FinanceContext } from "../../finance/context.js";
import type { Connection } from "../../finance/schemas.js";
import type { FinanceProvider } from "../provider.js";
import { createPlaidClient, type PlaidClient, readPlaidResponse } from "./client.js";
import { readItemDetails } from "./link.js";
import { readPlaidAccounts } from "./readers/accounts.js";
import { readInvestmentActivity, readPlaidHoldings } from "./readers/investments.js";
import { readTransactionChanges } from "./readers/transactions/sync.js";

type PlaidAccess = {
  client: PlaidClient;
  token: string;
};

export async function resolvePlaidProvider(
  context: FinanceContext,
  connection: Connection,
): Promise<FinanceProvider> {
  return createPlaidProvider(context.env, await readPlaidCredential(context, connection));
}
export async function readPlaidCredential(
  context: FinanceContext,
  connection: Connection,
): Promise<string> {
  return decryptCredential(
    context.env,
    connection.id,
    readEncryptedCredential(context.db, connection.id),
  );
}
export function createPlaidProvider(env: Env, token: string): FinanceProvider {
  const access = {
    client: createPlaidClient(env),
    token,
  };
  return {
    readMetadata: () => readItemDetails(access.client, access.token),
    readSnapshot: (connection) => readSnapshot(access, connection),
    readChanges: (connection, cursor) => readChanges(access, connection, cursor),
    disconnect: () => revokeAccess(access),
  };
}
async function readSnapshot(access: PlaidAccess, connection: Connection) {
  const accounts = await readPlaidAccounts(access.client, access.token, connection);
  const holdings = await readHoldingsIfSupported(access, connection);
  return {
    ...accounts,
    holdings,
  };
}
async function readChanges(access: PlaidAccess, connection: Connection, cursor: string | null) {
  const cash = await readBankingChangesIfSupported(access, connection, cursor);
  const investments = await readInvestmentChangesIfSupported(access, connection);
  return {
    cash,
    investments,
  };
}
async function readHoldingsIfSupported(access: PlaidAccess, connection: Connection) {
  if (!connection.capabilities.includes("holdings")) {
    return null;
  }
  return readPlaidHoldings(access.client, access.token, connection.id);
}
async function readBankingChangesIfSupported(
  access: PlaidAccess,
  connection: Connection,
  cursor: string | null,
) {
  if (!connection.capabilities.includes("transactions")) {
    return null;
  }
  return readTransactionChanges(access.client, access.token, connection.id, cursor);
}
async function readInvestmentChangesIfSupported(access: PlaidAccess, connection: Connection) {
  if (!connection.capabilities.includes("investment_activity")) {
    return null;
  }
  return readInvestmentActivity(
    access.client,
    access.token,
    connection.id,
    connection.last_success_at,
  );
}
async function revokeAccess(access: PlaidAccess): Promise<void> {
  try {
    await readPlaidResponse(
      z.object({}),
      access.client.itemRemove({
        access_token: access.token,
      }),
    );
  } catch (error) {
    if (!isAlreadyRevoked(error)) {
      throw error;
    }
  }
}
function isAlreadyRevoked(error: unknown): boolean {
  return error instanceof AuthenticationError && error.code === "ITEM_NOT_FOUND";
}
