import * as z from "zod";
import { ownerSession, ownerStore } from "../../config/env.js";
import {
  beginBrowserSignIn,
  clearOwnerSession,
  completeBrowserSignIn,
  requireOwnerSession,
} from "../../modules/auth/session.js";
import { handlePlaidWebhook } from "../../modules/integrations/plaid/webhooks.js";
import type { WebContext } from "./context.js";
import { approveOrDeny, completeIdentity, showConsent } from "./oauth.js";
import { benepassCodePage, connectionsPage, signedOutPage } from "./pages/connections.js";
import { htmlResponse } from "./pages/layout.js";

export async function signIn(context: WebContext): Promise<Response> {
  return beginBrowserSignIn(context.var.configuration);
}
export async function showConnections(context: WebContext): Promise<Response> {
  const owner = await findOwner(context);
  if (!owner) {
    return htmlResponse(signedOutPage());
  }
  const data = await ownerStore(context.env).accounts();
  return htmlResponse(
    connectionsPage(
      owner,
      data.connections,
      data.accounts,
      data.preferences,
      context.var.configuration.BENEPASS_EMAIL,
    ),
  );
}
export async function showConsentPage(context: WebContext): Promise<Response> {
  return showConsent(context.req.raw, context.env);
}
export async function submitConsent(context: WebContext): Promise<Response> {
  return approveOrDeny(context.req.raw, context.env, context.var.configuration, context.var.form);
}
export async function completeSignIn(context: WebContext): Promise<Response> {
  const browser = await completeBrowserSignIn(context.req.raw, context.var.configuration);
  return browser ?? completeIdentity(context.req.raw, context.env, context.var.configuration);
}
export async function completePlaidLink(context: WebContext): Promise<Response> {
  const flow = z.uuid().parse(context.req.query("flow"));
  await ownerStore(context.env).completePlaidLink(flow);
  return redirectToConnections();
}
export async function startPlaidLink(context: WebContext): Promise<Response> {
  const kind = readAccountKind(context.var.form);
  const id = context.var.form.get("connection_id") ?? undefined;
  const url = await ownerStore(context.env).beginPlaidLink(kind, id);
  return Response.redirect(url, 302);
}
export async function startBenepassLogin(context: WebContext): Promise<Response> {
  const approved = context.var.form.get("registration") === "approved";
  await ownerSession(context.env).startLogin(context.var.owner.flowId, approved);
  return htmlResponse(benepassCodePage(context.var.owner));
}
export async function completeBenepassLogin(context: WebContext): Promise<Response> {
  const code = readLoginCode(context.var.form);
  await ownerSession(context.env).completeLogin(context.var.owner.flowId, code);
  await ownerStore(context.env).linkBenepass();
  await ownerStore(context.env).scheduleSync();
  return redirectToConnections();
}
export async function disconnect(context: WebContext): Promise<Response> {
  await ownerStore(context.env).disconnect(requiredField(context.var.form, "connection_id"));
  return redirectToConnections();
}
export async function refresh(context: WebContext): Promise<Response> {
  await ownerStore(context.env).syncConnection(requiredField(context.var.form, "connection_id"));
  return redirectToConnections();
}
export async function savePreference(context: WebContext): Promise<Response> {
  await ownerStore(context.env).setPreference(accountPreference(context.var.form));
  return redirectToConnections();
}
export function signOut(): Response {
  return clearOwnerSession();
}
async function findOwner(context: WebContext) {
  try {
    return await requireOwnerSession(context.req.raw, context.var.configuration);
  } catch {
    return undefined;
  }
}
function readAccountKind(form: URLSearchParams) {
  return z
    .enum([
      "bank",
      "investment",
    ])
    .parse(form.get("kind"));
}
function readLoginCode(form: URLSearchParams): string {
  return z
    .string()
    .regex(/^[0-9]{6}$/)
    .parse(form.get("otp"));
}
function accountPreference(form: URLSearchParams) {
  return {
    account_id: requiredField(form, "account_id"),
    label: form.get("label") || null,
    include_in_net_worth: form.has("net_worth"),
    include_in_spending: form.has("spending"),
  };
}
function requiredField(form: URLSearchParams, name: string): string {
  return z.string().min(1).max(500).parse(form.get(name));
}
function redirectToConnections(): Response {
  return new Response(null, {
    status: 302,
    headers: {
      location: "/connections",
      "cache-control": "no-store",
    },
  });
}

export async function receivePlaidWebhook(context: WebContext): Promise<Response> {
  return handlePlaidWebhook(context.req.raw, context.env);
}
