import { env } from "cloudflare:workers";
import { readConfiguration } from "../../config/env.js";
import { requireOwnerSession, saveOwnerSession } from "../../modules/auth/session.js";
import { createWebRouter } from "./routes.js";

const configuration = readConfiguration(env);
const origin = configuration.PUBLIC_ORIGIN;

afterEach(() => {
  vi.unstubAllGlobals();
});

async function signedOwner() {
  const headers = new Headers();
  await saveOwnerSession(headers, "fixture-owner", configuration);
  const cookie = headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  const request = new Request(`${origin}/connections`, {
    headers: {
      cookie,
    },
  });
  const owner = await requireOwnerSession(request, configuration);
  return {
    cookie,
    owner,
  };
}
function webFetch(path: string, init?: RequestInit) {
  return createWebRouter(configuration).fetch(new Request(`${origin}${path}`, init), env);
}
function formHeaders(cookie: string, requestOrigin = origin) {
  return {
    cookie,
    origin: requestOrigin,
    "content-type": "application/x-www-form-urlencoded",
  };
}

describe("Hono browser routes", () => {
  it("renders signed-out navigation and security headers", async () => {
    const response = await webFetch("/connections");
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("<a href='/sign-in'>Sign in</a>");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
  });
  it("requires an owner session before running mutations", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const response = await webFetch("/connections/plaid/start", {
      method: "POST",
      headers: formHeaders(""),
      body: "kind=bank&csrf=wrong",
    });
    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("rejects cross-origin and invalid-CSRF forms without clearing the session", async () => {
    const { cookie, owner } = await signedOwner();
    const crossOrigin = await webFetch("/sign-out", {
      method: "POST",
      headers: formHeaders(cookie, "https://untrusted.example"),
      body: `csrf=${owner.csrf}`,
    });
    const invalidCsrf = await webFetch("/sign-out", {
      method: "POST",
      headers: formHeaders(cookie),
      body: "csrf=wrong",
    });
    expect(crossOrigin.status).toBe(400);
    expect(invalidCsrf.status).toBe(400);
    expect(crossOrigin.headers.get("set-cookie")).toBeNull();
    expect(invalidCsrf.headers.get("set-cookie")).toBeNull();
  });
  it("accepts the signed owner's valid form", async () => {
    const { cookie, owner } = await signedOwner();
    const response = await webFetch("/sign-out", {
      method: "POST",
      headers: formHeaders(cookie),
      body: `csrf=${owner.csrf}`,
    });
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/connections");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });
  it("measures oversized forms even with a misleading Content-Length", async () => {
    const { cookie, owner } = await signedOwner();
    for (const extra of [
      {},
      {
        "content-length": "1",
      },
    ]) {
      const response = await webFetch("/sign-out", {
        method: "POST",
        headers: {
          ...formHeaders(cookie),
          ...extra,
        },
        body: `csrf=${owner.csrf}&padding=${"x".repeat(8192)}`,
      });
      expect(response.status).toBe(413);
      expect(response.headers.get("set-cookie")).toBeNull();
    }
  });
  it("rejects incorrect form encoding", async () => {
    const { cookie } = await signedOwner();
    const response = await webFetch("/sign-out", {
      method: "POST",
      headers: {
        cookie,
        origin,
        "content-type": "application/json",
      },
      body: "{}",
    });
    expect(response.status).toBe(400);
  });
  it("does not run callbacks or provider requests for HEAD", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    for (const path of [
      "/callback?code=fixture",
      "/connections/plaid/complete?flow=fixture",
      "/sign-in",
    ]) {
      expect(
        (
          await webFetch(path, {
            method: "HEAD",
          })
        ).status,
      ).toBe(405);
    }
    expect(fetch).not.toHaveBeenCalled();
  });
  it("returns 404 for unknown paths", async () => {
    expect((await webFetch("/unknown")).status).toBe(404);
  });
});
