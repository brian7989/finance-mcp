import { AuthorizationError, OAuthProvider } from "@cloudflare/workers-oauth-provider";
import { type Configuration, type Env, ownerStore, readConfiguration } from "./config/env.js";
import { handleAuthorization } from "./modules/auth/oauth/authorization.js";
import { errorPage, htmlResponse } from "./modules/auth/oauth/pages.js";
import { handlePlaidWebhook } from "./modules/integrations/plaid/webhooks.js";
import { serveMcp } from "./transports/mcp/server.js";

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
      if (url.pathname === "/webhooks/plaid" && request.method === "POST") {
        return handlePlaidWebhook(request, env);
      }
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
      fetch: (request, env) => handleAuthorization(request, env, configuration),
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
function safeFailure(error: unknown): Response {
  if (error instanceof AuthorizationError && error.redirectTo) {
    return Response.redirect(error.redirectTo, 302);
  }
  console.error("finance-mcp: request failed");
  return htmlResponse(errorPage(), new Headers(), 400);
}
