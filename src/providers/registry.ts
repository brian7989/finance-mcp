import type { Env } from "../config.js";
import type { Connection } from "../finance/schemas.js";
import { readBenepassSnapshot } from "./benepass/finance.js";
import { readPlaidAccounts } from "./plaid/accounts.js";
import { createPlaidClient } from "./plaid/client.js";
import { readPlaidHoldings } from "./plaid/investments.js";
import type { FinanceProvider } from "./provider.js";

export function createProvider(env: Env, connection: Connection, token?: string): FinanceProvider {
  if (connection.provider === "benepass") {
    return {
      readSnapshot: () => readBenepassSnapshot(env),
    };
  }
  if (!token) {
    throw new Error("Missing provider credential");
  }
  const client = createPlaidClient(env);
  return {
    async readSnapshot() {
      const accounts = await readPlaidAccounts(client, token, connection);
      const holdings = connection.capabilities.includes("holdings")
        ? await readPlaidHoldings(client, token, connection.id)
        : null;
      return {
        ...accounts,
        holdings,
      };
    },
  };
}
