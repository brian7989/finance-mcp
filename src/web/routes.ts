import * as z from "zod";
import { assertSameOrigin, readForm } from "../auth/browser.js";
import { htmlResponse } from "../auth/pages.js";
import {
  assertOwnerCsrf,
  beginBrowserSignIn,
  clearOwnerSession,
  type OwnerSession,
  requireOwnerSession,
} from "../auth/session.js";
import { type Configuration, type Env, ownerSession, ownerStore } from "../config.js";
import { benepassCodePage, connectionsPage, signedOutPage } from "./connections-page.js";

export async function handleWeb(
  request: Request,
  env: Env,
  configuration: Configuration,
): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === "/sign-in" && request.method === "GET") {
    return beginBrowserSignIn(configuration);
  }
  if (
    [
      "/",
      "/connections",
    ].includes(url.pathname) &&
    request.method === "GET"
  ) {
    return showConnections(request, env, configuration);
  }
  const owner = await requireOwnerSession(request, configuration);
  if (url.pathname === "/connections/plaid/complete" && request.method === "GET") {
    await ownerStore(env).completePlaidLink(z.uuid().parse(url.searchParams.get("flow")));
    return redirectToConnections();
  }
  if (request.method !== "POST") {
    return new Response("Not found", {
      status: 404,
    });
  }
  assertSameOrigin(request, configuration);
  const form = await readForm(request);
  assertOwnerCsrf(form, owner);
  return handleOwnerAction(url.pathname, form, owner, env);
}
async function showConnections(
  request: Request,
  env: Env,
  configuration: Configuration,
): Promise<Response> {
  let owner: OwnerSession;
  try {
    owner = await requireOwnerSession(request, configuration);
  } catch {
    return htmlResponse(signedOutPage());
  }
  const data = await ownerStore(env).accounts();
  return htmlResponse(
    connectionsPage(
      owner,
      data.connections,
      data.accounts,
      data.preferences,
      configuration.BENEPASS_EMAIL,
    ),
  );
}
async function handleOwnerAction(
  path: string,
  form: URLSearchParams,
  owner: OwnerSession,
  env: Env,
): Promise<Response> {
  switch (path) {
    case "/connections/plaid/start":
      return startPlaidLink(form, env);
    case "/connections/benepass/start":
      return startBenepassLogin(form, owner, env);
    case "/connections/benepass/complete":
      return completeBenepassLogin(form, owner, env);
    case "/connections/disconnect":
      await ownerStore(env).disconnect(requiredField(form, "connection_id"));
      return redirectToConnections();
    case "/connections/sync":
      await ownerStore(env).syncConnection(requiredField(form, "connection_id"));
      return redirectToConnections();
    case "/accounts/preferences":
      await saveAccountPreference(form, env);
      return redirectToConnections();
    case "/sign-out":
      return clearOwnerSession();
    default:
      return new Response("Not found", {
        status: 404,
      });
  }
}
async function startPlaidLink(form: URLSearchParams, env: Env): Promise<Response> {
  const kind = z
    .enum([
      "bank",
      "investment",
    ])
    .parse(form.get("kind"));
  const connectionId = form.get("connection_id") ?? undefined;
  const target = await ownerStore(env).beginPlaidLink(kind, connectionId);
  return Response.redirect(target, 302);
}
async function startBenepassLogin(
  form: URLSearchParams,
  owner: OwnerSession,
  env: Env,
): Promise<Response> {
  await ownerSession(env).startLogin(owner.flowId, form.get("registration") === "approved");
  return htmlResponse(benepassCodePage(owner));
}
async function completeBenepassLogin(
  form: URLSearchParams,
  owner: OwnerSession,
  env: Env,
): Promise<Response> {
  const code = z
    .string()
    .regex(/^[0-9]{6}$/)
    .parse(form.get("otp"));
  await ownerSession(env).completeLogin(owner.flowId, code);
  await ownerStore(env).linkBenepass();
  await ownerStore(env).scheduleSync();
  return redirectToConnections();
}
async function saveAccountPreference(form: URLSearchParams, env: Env): Promise<void> {
  await ownerStore(env).setPreference({
    account_id: requiredField(form, "account_id"),
    label: form.get("label") || null,
    include_in_net_worth: form.has("net_worth"),
    include_in_spending: form.has("spending"),
  });
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
