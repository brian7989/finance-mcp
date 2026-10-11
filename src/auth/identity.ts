import { createRemoteJWKSet, jwtVerify } from "jose";
import * as z from "zod";
import type { Configuration } from "../config.js";
import { normalizeEmail } from "../config.js";
import { fetchJson } from "../providers/benepass/http.js";

const DiscoverySchema = z.object({
  issuer: z.url(),
  authorization_endpoint: z.url(),
  token_endpoint: z.url(),
  jwks_uri: z.url(),
});
const TokenSchema = z.object({
  id_token: z.string().min(1),
});
const IdentitySchema = z.object({
  sub: z.string().min(1),
  email: z.email(),
  email_verified: z.boolean().optional(),
  nonce: z.string(),
});
const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
export type IdentityProof = {
  verifier: string;
  nonce: string;
};

export function createIdentityProof(): IdentityProof {
  return {
    verifier: crypto.randomUUID() + crypto.randomUUID(),
    nonce: crypto.randomUUID(),
  };
}
export async function identityAuthorizeUrl(
  configuration: Configuration,
  state: string,
  proof: IdentityProof,
): Promise<string> {
  const discovery = await discoverIdentityProvider(configuration);
  const url = new URL(discovery.authorization_endpoint);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: configuration.ACCESS_CLIENT_ID,
    redirect_uri: callbackUrl(configuration),
    scope: "openid email",
    state,
    nonce: proof.nonce,
    code_challenge_method: "S256",
    code_challenge: await pkceChallenge(proof.verifier),
  }).toString();
  return url.toString();
}
export async function verifyIdentityCode(
  configuration: Configuration,
  code: string,
  proof: IdentityProof,
): Promise<string> {
  const discovery = await discoverIdentityProvider(configuration);
  const payload = await exchangeIdentityCode(
    configuration,
    discovery.token_endpoint,
    code,
    proof.verifier,
  );
  const token = TokenSchema.parse(payload);
  const { payload: claims } = await jwtVerify(token.id_token, identityKeys(discovery.jwks_uri), {
    issuer: discovery.issuer,
    audience: configuration.ACCESS_CLIENT_ID,
    algorithms: [
      "RS256",
    ],
    requiredClaims: [
      "exp",
      "sub",
      "nonce",
    ],
  });
  const identity = IdentitySchema.parse(claims);
  assertAllowedIdentity(identity, proof.nonce, configuration.OWNER_EMAIL);
  return identity.sub;
}
export function assertAllowedIdentity(
  identity: z.infer<typeof IdentitySchema>,
  nonce: string,
  ownerEmail: string,
): void {
  if (
    identity.nonce !== nonce ||
    identity.email_verified === false ||
    normalizeEmail(identity.email) !== ownerEmail
  ) {
    throw new Error("Access denied");
  }
}
async function discoverIdentityProvider(configuration: Configuration) {
  const issuer = configuration.ACCESS_ISSUER.replace(/\/$/, "");
  const payload = await fetchJson(`${issuer}/.well-known/openid-configuration`);
  const discovery = DiscoverySchema.parse(payload);
  if (discovery.issuer.replace(/\/$/, "") !== issuer) {
    throw new Error("Identity issuer mismatch");
  }
  for (const value of [
    discovery.authorization_endpoint,
    discovery.token_endpoint,
    discovery.jwks_uri,
  ]) {
    if (new URL(value).origin !== new URL(issuer).origin || new URL(value).protocol !== "https:") {
      throw new Error("Invalid identity endpoint");
    }
  }
  return discovery;
}
function exchangeIdentityCode(
  configuration: Configuration,
  endpoint: string,
  code: string,
  verifier: string,
): Promise<unknown> {
  return fetchJson(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: configuration.ACCESS_CLIENT_ID,
      client_secret: configuration.ACCESS_CLIENT_SECRET,
      redirect_uri: callbackUrl(configuration),
      code,
      code_verifier: verifier,
    }),
  });
}
function identityKeys(url: string) {
  let keys = keySets.get(url);
  if (!keys) {
    keys = createRemoteJWKSet(new URL(url), {
      timeoutDuration: 10_000,
    });
    keySets.set(url, keys);
  }
  return keys;
}
function callbackUrl(configuration: Configuration): string {
  return `${configuration.PUBLIC_ORIGIN}/callback`;
}
async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
