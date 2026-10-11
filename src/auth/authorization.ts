import { authorizationErrorRedirect } from "@cloudflare/workers-oauth-provider";
import * as z from "zod";
import type { Configuration, Env } from "../config.js";
import { handleWeb } from "../web/routes.js";
import { assertSameOrigin, readForm } from "./browser.js";
import {
  createIdentityProof,
  type IdentityProof,
  identityAuthorizeUrl,
  verifyIdentityCode,
} from "./identity.js";
import { consentPage, htmlResponse } from "./pages.js";
import { completeBrowserSignIn, saveOwnerSession } from "./session.js";

export async function handleAuthorization(
  request: Request,
  env: Env,
  configuration: Configuration,
): Promise<Response> {
  const path = new URL(request.url).pathname;
  if (path === "/authorize" && request.method === "GET") {
    return showConsent(request, env);
  }
  if (path === "/authorize" && request.method === "POST") {
    return approveOrDeny(request, env, configuration);
  }
  if (path === "/callback" && request.method === "GET") {
    return (
      (await completeBrowserSignIn(request, configuration)) ??
      completeIdentity(request, env, configuration)
    );
  }
  return handleWeb(request, env, configuration);
}
async function showConsent(request: Request, env: Env): Promise<Response> {
  const original = await env.OAUTH_PROVIDER.parseAuthRequest(request);
  const details = await env.OAUTH_PROVIDER.describeConsent(original);
  const consent = await env.OAUTH_PROVIDER.beginConsent(original);
  return htmlResponse(consentPage(details, consent.handle), consent.headers);
}
async function approveOrDeny(
  request: Request,
  env: Env,
  configuration: Configuration,
): Promise<Response> {
  assertSameOrigin(request, configuration);
  const form = await readForm(request);
  const handle = z.string().min(1).max(1024).parse(form.get("handle"));
  if (form.get("decision") !== "approve") {
    const denied = await env.OAUTH_PROVIDER.denyConsent(request, handle);
    return redirectResponse(denied.headers);
  }
  const approved = await env.OAUTH_PROVIDER.approveConsent(request, handle, {
    scope: [
      "finance:read",
      "offline_access",
    ],
  });
  const proof = createIdentityProof();
  const upstream = await env.OAUTH_PROVIDER.beginUpstream(approved.request, {
    data: proof,
    headers: approved.headers,
  });
  upstream.headers.set(
    "location",
    await identityAuthorizeUrl(configuration, upstream.state, proof),
  );
  return redirectResponse(upstream.headers);
}
async function completeIdentity(
  request: Request,
  env: Env,
  configuration: Configuration,
): Promise<Response> {
  const resumed = await env.OAUTH_PROVIDER.finishUpstream<IdentityProof>(request);
  const url = new URL(request.url);
  if (url.searchParams.has("error")) {
    resumed.headers.set("location", authorizationErrorRedirect(resumed.request, "access_denied"));
    return redirectResponse(resumed.headers);
  }
  const code = z.string().min(1).max(4096).parse(url.searchParams.get("code"));
  const subject = await verifyIdentityCode(configuration, code, resumed.data);
  const result = await env.OAUTH_PROVIDER.completeAuthorization({
    request: resumed.request,
    userId: subject,
    metadata: {},
    scope: resumed.request.scope,
    props: {
      subject,
      ownerEmail: configuration.OWNER_EMAIL,
    },
  });
  await saveOwnerSession(resumed.headers, subject, configuration);
  resumed.headers.set("location", result.redirectTo);
  return redirectResponse(resumed.headers);
}
function redirectResponse(headers: Headers): Response {
  headers.set("cache-control", "no-store");
  return new Response(null, {
    status: 302,
    headers,
  });
}
