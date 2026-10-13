import { CookieJar } from "tough-cookie";
import type * as z from "zod";
import { AuthenticationError } from "../../../common/errors.js";

export const UMB_ORIGIN = "https://myumbhsa.wealthcareportal.com";
const readablePaths =
  /^\/(Accounts\/(List|GetHsa\/\d+)|Investments\/GetForAccount\/\d+|Transactions\/(GetYearsWithAccounts|GetPage))$/;
const authenticationPaths = new Set([
  "/Authentication/Handshake",
  "/Authentication/GetUserInfo",
  "/Authentication/GenerateCode",
  "/Authentication/SubmitCode",
  "/Authentication/VerifyCode",
  "/Authentication/LogOff",
]);

export class UmbClient {
  private readonly cookies: CookieJar;
  private requests = 0;

  constructor(serialized?: string) {
    this.cookies = serialized ? CookieJar.deserializeSync(JSON.parse(serialized)) : new CookieJar();
  }
  serialize(): string {
    return JSON.stringify(this.cookies.serializeSync());
  }
  async read<T>(path: string, schema: z.ZodType<T>): Promise<T> {
    if (!readablePaths.test(new URL(path, UMB_ORIGIN).pathname)) {
      throw new Error("Unsupported UMB data route");
    }
    const response = await this.request(path);
    if (new URL(response.url || `${UMB_ORIGIN}${path}`).pathname.startsWith("/Authentication/")) {
      throw new AuthenticationError("UMB session expired", "UMB_SESSION_EXPIRED");
    }
    if (response.headers.get("content-type")?.includes("text/html")) {
      throw new AuthenticationError("UMB session expired", "UMB_SESSION_EXPIRED");
    }
    return schema.parse(JSON.parse(await boundedText(response)));
  }
  async authenticate(path: string, form?: URLSearchParams): Promise<Response> {
    if (!authenticationPaths.has(path)) {
      throw new Error("Unsupported UMB authentication route");
    }
    return this.request(path, form);
  }
  private async request(path: string, form?: URLSearchParams): Promise<Response> {
    let url = new URL(path, UMB_ORIGIN);
    let body = form;
    for (let redirects = 0; redirects < 6; ++redirects) {
      assertPortalUrl(url);
      const response = await this.fetchPortal(url, body);
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        await response.body?.cancel();
        if (!location || response.status === 307 || response.status === 308) {
          throw new Error("Unsupported UMB redirect");
        }
        url = new URL(location, url);
        body = undefined;
        continue;
      }
      assertSuccessfulResponse(response);
      return response;
    }
    throw new Error("Too many UMB redirects");
  }
  private async fetchPortal(url: URL, form?: URLSearchParams): Promise<Response> {
    if (++this.requests > 50) {
      throw new Error("UMB request budget exceeded");
    }
    const headers = new Headers({
      accept: "application/json,text/html",
      "user-agent": "finance-mcp",
      "x-requested-with": "XMLHttpRequest",
    });
    const cookie = await this.cookies.getCookieString(url.href);
    if (cookie) {
      headers.set("cookie", cookie);
    }
    if (form) {
      headers.set("content-type", "application/x-www-form-urlencoded");
      headers.set("origin", UMB_ORIGIN);
      headers.set("referer", `${UMB_ORIGIN}/Authentication/Handshake`);
    }
    const response = await fetch(url, {
      method: form ? "POST" : "GET",
      headers,
      body: form ?? null,
      redirect: "manual",
      signal: AbortSignal.timeout(25000),
    });
    for (const value of response.headers.getSetCookie()) {
      await this.cookies.setCookie(value, url.href);
    }
    return response;
  }
}
export async function boundedText(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Empty UMB response");
  }
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      size += value.byteLength;
      if (size > 3_000_000) {
        throw new Error("UMB response too large");
      }
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}
function assertPortalUrl(url: URL): void {
  if (url.origin !== UMB_ORIGIN || url.username || url.password) {
    throw new Error("Unsupported UMB destination");
  }
}
function assertSuccessfulResponse(response: Response): void {
  if (response.status === 401 || response.status === 403) {
    throw new AuthenticationError("UMB sign-in required", "UMB_SESSION_EXPIRED");
  }
  if (!response.ok) {
    throw new Error("UMB portal unavailable");
  }
}
