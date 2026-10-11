import * as z from "zod";
import { type Env, ownerStore } from "../../config.js";
import { ConnectionSchema } from "../../finance/schemas.js";
import { emptyInput, type RegisterTool } from "./register.js";

export function registerConnections(register: RegisterTool, env: Env): void {
  register(
    "connection_status",
    "Show linked institutions, supported data, last successful refresh, and reconnection requirements. Manage connections in the browser.",
    emptyInput,
    z.object({
      connections: z.array(
        ConnectionSchema.omit({
          revision: true,
        }),
      ),
      management_url: z.string(),
    }),
    async () => ({
      ...(await ownerStore(env).connections()),
      management_url: `${env.PUBLIC_ORIGIN}/connections`,
    }),
  );
}
