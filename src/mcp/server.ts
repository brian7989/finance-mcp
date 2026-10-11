import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";
import manifest from "../../package.json";
import { type Env, readConfiguration } from "../config.js";
import { registerTools } from "./tools/index.js";

const IdentitySchema = z.object({
  subject: z.string().min(1),
  ownerEmail: z.email(),
});
const AccessSchema = z.object({
  scope: z.array(z.string()),
});

export async function serveMcp(
  request: Request,
  env: Env,
  context: ExecutionContext,
): Promise<Response> {
  const configuration = readConfiguration(env);
  const identity = IdentitySchema.safeParse(context.props);
  if (!identity.success || identity.data.ownerEmail !== configuration.OWNER_EMAIL) {
    return new Response("Forbidden", {
      status: 403,
    });
  }
  const access = AccessSchema.safeParse("auth" in context ? context.auth : undefined);
  if (!access.success || !access.data.scope.includes("finance:read")) {
    return new Response("Insufficient scope", {
      status: 403,
    });
  }
  const handler = createMcpHandler(() => createServer(env), {
    responseMode: "json",
  });
  try {
    return await handler.fetch(request);
  } finally {
    await handler.close();
  }
}
export function createServer(env: Env): McpServer {
  const server = new McpServer({
    name: manifest.name,
    version: manifest.version,
  });
  registerTools(server, env);
  return server;
}
