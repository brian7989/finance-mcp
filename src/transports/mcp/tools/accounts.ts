import * as z from "zod";
import { type Env, ownerStore } from "../../../config/env.js";
import {
  AccountSchema,
  ConnectionSchema,
  PreferenceSchema,
} from "../../../modules/finance/schemas.js";
import { emptyInput, type RegisterTool } from "./register.js";

export function registerAccounts(register: RegisterTool, env: Env): void {
  register(
    "list_accounts",
    "List saved accounts, reporting preferences, capabilities, and connection status. Connect accounts through the browser management page.",
    emptyInput,
    z.object({
      accounts: z.array(AccountSchema),
      preferences: z.array(PreferenceSchema),
      connections: z.array(
        ConnectionSchema.omit({
          revision: true,
        }),
      ),
    }),
    () => ownerStore(env).accounts(),
  );
}
