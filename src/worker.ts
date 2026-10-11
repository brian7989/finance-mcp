import { AuthorizationError, OAuthProvider } from "@cloudflare/workers-oauth-provider";
import { type Configuration, type Env, ownerStore, readConfiguration } from "./config/env.js";
import { serveMcp } from "./transports/mcp/server.js";
import { errorPage } from "./transports/web/pages/consent.js";
import { htmlResponse } from "./transports/web/pages/layout.js";
import { createWebRouter } from "./transports/web/routes.js";

export { FinanceStore } from "./database/finance-store.js";
export { BenepassSession } from "./modules/integrations/benepass/auth/session.js";

export default {
  async fetch(request: Request, env: Env, context: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health" && request.method === "GET") {
      return Response.json({
        ok: true,
      });
    }
    const configuration = readSafeConfiguration(env);
    if (!configuration) {
      return new Response("Server configuration is incomplete", {
        status: 503,
      });
    }
    if (url.origin !== configuration.PUBLIC_ORIGIN) {
      return new Response("Forbidden", {
        status: 403,
      });
    }
    const origin = request.headers.get("origin");
    if (origin && origin !== configuration.PUBLIC_ORIGIN) {
      return new Response("Forbidden", {
        status: 403,
      });
    }
    try {
      return await createOAuthProvider(configuration).fetch(request, env, context);
    } catch (error) {
      return safeFailure(error);
    }
  },
  async scheduled(_event: ScheduledController, env: Env): Promise<void> {
    await ownerStore(env).scheduleSync();
  },
} satisfies ExportedHandler<Env>;

function createOAuthProvider(configuration: Configuration): OAuthProvider<Env> {
  return new OAuthProvider<Env>({
    apiRoute: "/mcp",
    apiHandler: {
      fetch: serveMcp,
    },
    defaultHandler: {
      fetch: (request, env) => createWebRouter(configuration).fetch(request, env),
    },
    authorizeEndpoint: "/authorize",
    tokenEndpoint: "/oauth/token",
    scopesSupported: [
      "finance:read",
      "offline_access",
    ],
    requiredScopes: [
      "finance:read",
    ],
    resourceMetadata: {
      resource: `${configuration.PUBLIC_ORIGIN}/mcp`,
      authorization_servers: [
        configuration.PUBLIC_ORIGIN,
      ],
    },
    clientIdMetadataDocumentEnabled: true,
    onError: () => console.error("finance-mcp: OAuth request rejected"),
  });
}
function readSafeConfiguration(env: Env): Configuration | undefined {
  try {
    return readConfiguration(env);
  } catch {
    return undefined;
  }
}
async function safeFailure(error: unknown): Promise<Response> {
  if (error instanceof AuthorizationError && error.redirectTo) {
    return Response.redirect(error.redirectTo, 302);
  }
  console.error("finance-mcp: request failed");
  return htmlResponse(errorPage(), new Headers(), 400);
}
