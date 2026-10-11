import * as z from "zod";
import { type Env, ownerStore } from "../../config.js";
import { QuerySchema, TransactionSchema } from "../../finance/schemas.js";
import type { RegisterTool } from "./register.js";

export function registerTransactions(register: RegisterTool, env: Env): void {
  register(
    "list_transactions",
    "Read saved cash transactions and investment activity. Cash amounts use positive inflows and negative outflows; investment amounts retain provider semantics. Respect spending exclusions and pending status when analyzing spending.",
    QuerySchema,
    z.object({
      transactions: z.array(TransactionSchema),
      limit: z.number(),
      offset: z.number(),
    }),
    (query) => ownerStore(env).transactions(query),
  );
}
