import type { McpServer } from "@modelcontextprotocol/server";
import type { Env } from "../../config.js";
import { registerAccounts } from "./accounts.js";
import { registerBalanceHistory, registerBalances, registerNetWorth } from "./balances.js";
import { registerConnections } from "./connections.js";
import { registerInvestments } from "./investments.js";
import { createToolRegistrar } from "./register.js";
import { registerTransactions } from "./transactions.js";

export function registerTools(server: McpServer, env: Env): void {
  const register = createToolRegistrar(server);
  registerAccounts(register, env);
  registerBalances(register, env);
  registerBalanceHistory(register, env);
  registerNetWorth(register, env);
  registerTransactions(register, env);
  registerInvestments(register, env);
  registerConnections(register, env);
}
