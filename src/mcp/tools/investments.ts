import * as z from "zod";
import { type Env, ownerStore } from "../../config.js";
import { ConnectionSchema, HoldingSchema } from "../../finance/schemas.js";
import { emptyInput, type RegisterTool } from "./register.js";

export function registerInvestments(register: RegisterTool, env: Env): void {
  register(
    "get_holdings",
    "Read saved investment holdings. Values are components of account balances, not additional assets. Missing support is shown in connection capabilities.",
    emptyInput,
    z.object({
      holdings: z.array(HoldingSchema),
      connections: z.array(
        ConnectionSchema.omit({
          revision: true,
        }),
      ),
    }),
    () => ownerStore(env).holdings(),
  );
}
