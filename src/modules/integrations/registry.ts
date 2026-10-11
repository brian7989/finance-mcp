import type { Env } from "../../config/env.js";
import { ownerSession } from "../../config/env.js";
import type { Connection } from "../finance/schemas.js";
import { readBenepassSnapshot } from "./benepass/provider.js";
import { createPlaidProvider } from "./plaid/provider.js";
import type { FinanceProvider } from "./provider.js";

export function createProvider(
  env: Env,
  connection: Connection,
  credential?: string,
): FinanceProvider {
  if (connection.provider === "benepass") {
    return {
      async readMetadata() {
        return {
          institution: "Benepass",
          capabilities: [
            "balances",
            "holdings",
          ],
        };
      },
      readSnapshot: () => readBenepassSnapshot(env),
      async readChanges() {
        return {
          cash: null,
          investments: null,
        };
      },
      async disconnect() {
        await ownerSession(env).logout();
      },
    };
  }
  if (!credential) {
    throw new Error("Missing provider credential");
  }
  return createPlaidProvider(env, credential);
}
