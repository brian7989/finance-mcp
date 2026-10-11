import * as z from "zod";
import { type Env, ownerStore } from "../../config.js";
import { getNetWorth } from "../../finance/queries.js";
import {
  BalanceSchema,
  ConnectionSchema,
  DecimalSchema,
  QuerySchema,
} from "../../finance/schemas.js";
import { emptyInput, type RegisterTool } from "./register.js";

export function registerBalances(register: RegisterTool, env: Env): void {
  register(
    "get_balances",
    "Read the latest saved balance observations. fetched_at is retrieval time, not live valuation. Check connection status for stale data.",
    emptyInput,
    z.object({
      balances: z.array(BalanceSchema),
      connections: z.array(
        ConnectionSchema.omit({
          revision: true,
        }),
      ),
    }),
    () => ownerStore(env).balances(),
  );
}
export function registerNetWorth(register: RegisterTool, env: Env): void {
  register(
    "get_net_worth",
    "Calculate personal totals by currency, subtract debts, apply account exclusions, and identify incomplete results. Holdings are already included in account balances.",
    emptyInput,
    z.object({
      totals: z.array(
        z.object({
          currency: z.string(),
          amount: DecimalSchema,
        }),
      ),
      missing_account_ids: z.array(z.string()),
      complete: z.boolean(),
      unavailable_connection_ids: z.array(z.string()),
      fetched_at: z.iso.datetime(),
      balance_observations: z.array(BalanceSchema),
    }),
    () => getNetWorth(env),
  );
}
export function registerBalanceHistory(register: RegisterTool, env: Env): void {
  register(
    "get_balance_history",
    "Read saved daily balance observations. History begins when this connector observes an account; earlier balances are not reconstructed from transactions. Paginate with limit and offset.",
    QuerySchema,
    z.object({
      observations: z.array(BalanceSchema),
      limit: z.number(),
      offset: z.number(),
    }),
    (query) => ownerStore(env).balanceHistory(query),
  );
}
