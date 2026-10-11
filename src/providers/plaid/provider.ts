import * as z from "zod";
import type { Env } from "../../config.js";
import type { FinanceProvider } from "../provider.js";
import { readPlaidAccounts } from "./accounts.js";
import { createPlaidClient, readPlaidResponse } from "./client.js";
import { readInvestmentActivity, readPlaidHoldings } from "./investments.js";
import { readItemDetails } from "./link.js";
import { readTransactionChanges } from "./sync.js";

export function createPlaidProvider(env: Env, token: string): FinanceProvider {
  const client = createPlaidClient(env);
  return {
    readMetadata: () => readItemDetails(client, token),
    async readSnapshot(connection) {
      const accounts = await readPlaidAccounts(client, token, connection);
      const holdings = connection.capabilities.includes("holdings")
        ? await readPlaidHoldings(client, token, connection.id)
        : null;
      return {
        ...accounts,
        holdings,
      };
    },
    async readChanges(connection, cursor) {
      const cash = connection.capabilities.includes("transactions")
        ? await readTransactionChanges(client, token, connection.id, cursor)
        : null;
      const investments = connection.capabilities.includes("investment_activity")
        ? await readInvestmentActivity(client, token, connection.id, connection.last_success_at)
        : null;
      return {
        cash,
        investments,
      };
    },
    async disconnect() {
      await readPlaidResponse(
        z.object({}),
        client.itemRemove({
          access_token: token,
        }),
      );
    },
  };
}
