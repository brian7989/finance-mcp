import * as oidc from "openid-client";
import * as z from "zod";
import { type Configuration, normalizeEmail } from "../config.js";

const IdentitySchema = z.object({
  sub: z.string().min(1),
  email: z.email(),
  email_verified: z.boolean().optional(),
  nonce: z.string(),
});
export type IdentityProof = {
  verifier: string;
  nonce: string;
};

export function createIdentityProof(): IdentityProof {
  return {
    verifier: oidc.randomPKCECodeVerifier(),
    nonce: oidc.randomNonce(),
  };
}
export async function identityAuthorizeUrl(
  configuration: Configuration,
  state: string,
  proof: IdentityProof,
): Promise<string> {
  const client = await discoverIdentity(configuration);
  return oidc.buildAuthorizationUrl(client, {
    redirect_uri: callbackUrl(configuration),
    scope: "openid email",
    state,
    nonce: proof.nonce,
    code_challenge_method: "S256",
    code_challenge: await oidc.calculatePKCECodeChallenge(proof.verifier),
  }).href;
}
export async function verifyIdentityCode(
  configuration: Configuration,
  code: string,
  proof: IdentityProof,
): Promise<string> {
  const client = await discoverIdentity(configuration);
  const callback = new URL(callbackUrl(configuration));
  callback.searchParams.set("code", code);
  const tokens = await oidc.authorizationCodeGrant(client, callback, {
    pkceCodeVerifier: proof.verifier,
    expectedNonce: proof.nonce,
    idTokenExpected: true,
  });
  const identity = IdentitySchema.parse(tokens.claims());
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
async function discoverIdentity(configuration: Configuration): Promise<oidc.Configuration> {
  const issuer = new URL(configuration.ACCESS_ISSUER.replace(/\/$/, ""));
  const client = await oidc.discovery(
    issuer,
    configuration.ACCESS_CLIENT_ID,
    {
      client_secret: configuration.ACCESS_CLIENT_SECRET,
      id_token_signed_response_alg: "RS256",
    },
    oidc.ClientSecretPost(),
    {
      timeout: 10,
      execute: [
        oidc.enableNonRepudiationChecks,
      ],
      [oidc.customFetch]: (input, init) =>
        fetchIdentityEndpoint(
          input,
          {
            ...init,
            body: init.body ?? null,
          },
          issuer.origin,
        ),
    },
  );
  return client;
}
function fetchIdentityEndpoint(
  input: string,
  init: RequestInit | undefined,
  allowedOrigin: string,
): Promise<Response> {
  const url = new URL(input);
  if (url.protocol !== "https:" || url.origin !== allowedOrigin || url.username || url.password) {
    throw new Error("Invalid identity endpoint");
  }
  return fetch(url, {
    ...init,
    redirect: "manual",
  });
}
function callbackUrl(configuration: Configuration): string {
  return `${configuration.PUBLIC_ORIGIN}/callback`;
}
