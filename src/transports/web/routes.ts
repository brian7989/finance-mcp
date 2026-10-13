import { AuthorizationError } from "@cloudflare/workers-oauth-provider";
import type { Configuration } from "../../config/env.js";
import { webFactory } from "./context.js";
import {
  completeBenepassLogin,
  completePlaidLink,
  completeSignIn,
  completeUmbLogin,
  disconnect,
  receivePlaidWebhook,
  refresh,
  savePreference,
  sendUmbCode,
  showConnections,
  showConsentPage,
  signIn,
  signOut,
  startBenepassLogin,
  startPlaidLink,
  startUmbLogin,
  submitConsent,
} from "./handlers.js";
import {
  applyConfiguration,
  limitFormBody,
  readForm,
  rejectHeadRequests,
  requireOwner,
  verifyOwnerForm,
} from "./middleware.js";
import { errorPage } from "./pages/consent.js";
import { htmlResponse } from "./pages/layout.js";

export function createWebRouter(configuration: Configuration) {
  const app = webFactory.createApp();
  app.use("*", applyConfiguration(configuration), rejectHeadRequests);
  registerSignInRoutes(app);
  registerConnectionRoutes(app);
  app.post("/webhooks/plaid", receivePlaidWebhook);
  app.onError(renderFailure);
  return app;
}
type WebRouter = ReturnType<typeof webFactory.createApp>;

function registerSignInRoutes(app: WebRouter): void {
  app.get("/", showConnections);
  app.get("/connections", showConnections);
  app.get("/sign-in", signIn);
  app.get("/authorize", showConsentPage);
  app.get("/callback", completeSignIn);
  app.post("/authorize", limitFormBody, readForm, submitConsent);
  app.post("/sign-out", ...ownerFormHandlers, signOut);
}
const ownerFormHandlers = webFactory.createHandlers(
  requireOwner,
  limitFormBody,
  readForm,
  verifyOwnerForm,
);

function registerConnectionRoutes(app: WebRouter): void {
  app.post("/connections/umb/start", ...ownerFormHandlers, startUmbLogin);
  app.post("/connections/umb/code", ...ownerFormHandlers, sendUmbCode);
  app.post("/connections/umb/complete", ...ownerFormHandlers, completeUmbLogin);
  app.get("/connections/plaid/complete", requireOwner, completePlaidLink);
  app.post("/connections/plaid/start", ...ownerFormHandlers, startPlaidLink);
  app.post("/connections/benepass/start", ...ownerFormHandlers, startBenepassLogin);
  app.post("/connections/benepass/complete", ...ownerFormHandlers, completeBenepassLogin);
  app.post("/connections/disconnect", ...ownerFormHandlers, disconnect);
  app.post("/connections/sync", ...ownerFormHandlers, refresh);
  app.post("/accounts/preferences", ...ownerFormHandlers, savePreference);
}
async function renderFailure(error: Error): Promise<Response> {
  if (error instanceof AuthorizationError && error.redirectTo) {
    return Response.redirect(error.redirectTo, 302);
  }
  // Preserve the body-limit status without exposing exception or credential details.
  if ("status" in error && error.status === 413) {
    return new Response("Form too large", {
      status: 413,
    });
  }
  console.error("finance-mcp: web request rejected");
  return htmlResponse(errorPage(), new Headers(), 400);
}
