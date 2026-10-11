import { EncryptJWT, jwtDecrypt } from "jose";
import * as z from "zod";
import type { Configuration } from "../config.js";
import { createIdentityProof, identityAuthorizeUrl, verifyIdentityCode } from "./identity.js";

const OwnerSchema = z.object({
  subject: z.string(),
  email: z.email(),
  csrf: z.uuid(),
  flowId: z.uuid(),
});
const SignInSchema = z.object({
  state: z.uuid(),
  verifier: z.string(),
  nonce: z.string(),
});
export type OwnerSession = z.infer<typeof OwnerSchema>;

export async function beginBrowserSignIn(configuration: Configuration): Promise<Response> {
  const proof = createIdentityProof();
  const state = crypto.randomUUID();
  const target = await identityAuthorizeUrl(configuration, state, proof);
  const headers = new Headers({
    location: target,
  });
  await setEncryptedCookie(
    headers,
    "sign-in",
    {
      state,
      ...proof,
    },
    configuration,
    600,
  );
  return redirect(headers);
}
export async function completeBrowserSignIn(
  request: Request,
  configuration: Configuration,
): Promise<Response | undefined> {
  const encrypted = readCookie(request, "sign-in");
  if (!encrypted) {
    return undefined;
  }
  const flow = SignInSchema.parse(await decryptCookie(encrypted, "sign-in", configuration));
  const url = new URL(request.url);
  if (url.searchParams.get("state") !== flow.state) {
    return undefined;
  }
  const code = z.string().min(1).parse(url.searchParams.get("code"));
  const subject = await verifyIdentityCode(configuration, code, flow);
  const headers = new Headers({
    location: "/connections",
  });
  await saveOwnerSession(headers, subject, configuration);
  clearCookie(headers, "sign-in");
  return redirect(headers);
}
export async function saveOwnerSession(
  headers: Headers,
  subject: string,
  configuration: Configuration,
): Promise<void> {
  await setEncryptedCookie(
    headers,
    "owner",
    {
      subject,
      email: configuration.OWNER_EMAIL,
      csrf: crypto.randomUUID(),
      flowId: crypto.randomUUID(),
    },
    configuration,
    21600,
  );
}
export async function requireOwnerSession(
  request: Request,
  configuration: Configuration,
): Promise<OwnerSession> {
  const cookie = readCookie(request, "owner");
  if (!cookie) {
    throw new Error("Sign in required");
  }
  const owner = OwnerSchema.parse(await decryptCookie(cookie, "owner", configuration));
  if (owner.email !== configuration.OWNER_EMAIL) {
    throw new Error("Owner mismatch");
  }
  return owner;
}
export function assertOwnerCsrf(form: URLSearchParams, owner: OwnerSession): void {
  if (form.get("csrf") !== owner.csrf) {
    throw new Error("Invalid form token");
  }
}
export function clearOwnerSession(): Response {
  const headers = new Headers({
    location: "/connections",
  });
  clearCookie(headers, "owner");
  return redirect(headers);
}
async function setEncryptedCookie(
  headers: Headers,
  name: string,
  payload: Record<string, unknown>,
  configuration: Configuration,
  seconds: number,
): Promise<void> {
  const value = await new EncryptJWT(payload)
    .setProtectedHeader({
      alg: "dir",
      enc: "A256GCM",
    })
    .setIssuedAt()
    .setIssuer(configuration.PUBLIC_ORIGIN)
    .setAudience(name)
    .setExpirationTime(`${seconds}s`)
    .encrypt(browserKey(configuration));
  headers.append(
    "set-cookie",
    `__Host-finance-${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${seconds}`,
  );
}
async function decryptCookie(value: string, audience: string, configuration: Configuration) {
  const result = await jwtDecrypt(value, browserKey(configuration), {
    issuer: configuration.PUBLIC_ORIGIN,
    audience,
    requiredClaims: [
      "exp",
    ],
    keyManagementAlgorithms: [
      "dir",
    ],
    contentEncryptionAlgorithms: [
      "A256GCM",
    ],
  });
  return result.payload;
}
function browserKey(configuration: Configuration): Uint8Array {
  return Uint8Array.from(configuration.BROWSER_KEY.match(/../g) ?? [], (value) =>
    Number.parseInt(value, 16),
  );
}
function readCookie(request: Request, name: string): string | undefined {
  const prefix = `__Host-finance-${name}=`;
  return request.headers
    .get("cookie")
    ?.split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(prefix))
    ?.slice(prefix.length);
}
function clearCookie(headers: Headers, name: string): void {
  headers.append(
    "set-cookie",
    `__Host-finance-${name}=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0`,
  );
}
function redirect(headers: Headers): Response {
  headers.set("cache-control", "no-store");
  return new Response(null, {
    status: 302,
    headers,
  });
}
