import { authorizationErrorRedirect } from "@cloudflare/workers-oauth-provider";
import * as z from "zod";
import type { Configuration, Env } from "../../config/env.js";
import {
  createIdentityProof,
  type IdentityProof,
  identityAuthorizeUrl,
  verifyIdentityCode,
} from "../../modules/auth/identity.js";
import { saveOwnerSession } from "../../modules/auth/session.js";
import { consentPage } from "./pages/consent.js";
import { htmlResponse } from "./pages/layout.js";

export async function showConsent(request: Request, env: Env): Promise<Response> {
  const original = await env.OAUTH_PROVIDER.parseAuthRequest(request);
  const details = await env.OAUTH_PROVIDER.describeConsent(original);
  const consent = await env.OAUTH_PROVIDER.beginConsent(original);
  return htmlResponse(consentPage(details, consent.handle), consent.headers);
}
export async function approveOrDeny(
  request: Request,
  env: Env,
  configuration: Configuration,
  form: URLSearchParams,
): Promise<Response> {
  const handle = z.string().min(1).max(1024).parse(form.get("handle"));
  if (form.get("decision") !== "approve") {
    return denyConsent(request, env, handle);
  }
  return approveConsent(request, env, configuration, handle);
}
export async function completeIdentity(
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
async function denyConsent(request: Request, env: Env, handle: string): Promise<Response> {
  const denied = await env.OAUTH_PROVIDER.denyConsent(request, handle);
  return redirectResponse(denied.headers);
}
async function approveConsent(
  request: Request,
  env: Env,
  configuration: Configuration,
  handle: string,
): Promise<Response> {
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
function redirectResponse(headers: Headers): Response {
  headers.set("cache-control", "no-store");
  return new Response(null, {
    status: 302,
    headers,
  });
}
