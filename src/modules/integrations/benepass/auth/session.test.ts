import { evictDurableObject, runInDurableObject } from "cloudflare:test";
import { jsonResponse, seedSession, testSession } from "../../../../../test/helpers.js";
import { createCognitoAuth } from "./cognito.js";

vi.mock("./cognito.js", () => ({
  createCognitoAuth: vi.fn(),
}));
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("durable Benepass session", () => {
  it("survives instance eviction and removes credentials on logout", async () => {
    const stub = testSession();
    await seedSession(stub);
    await evictDurableObject(stub);
    expect(await stub.status()).toEqual({
      logged_in: true,
    });
    await stub.logout();
    await evictDurableObject(stub);
    expect(await stub.status()).toEqual({
      logged_in: false,
    });
  });
  it("does not send API requests when unlinked", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(await testSession().read("/v2/me/", {})).toEqual({
      ok: false,
      kind: "not_linked",
    });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("rejects an API origin escape before sending credentials", async () => {
    const stub = testSession();
    await seedSession(stub);
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(await stub.read("https://attacker.example/v2/me/", {})).toEqual({
      ok: false,
      kind: "schema",
    });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("coalesces concurrent refreshes and retries a 401 once", async () => {
    const stub = testSession();
    await seedSession(stub);
    let refreshes = 0;
    let reads = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) => {
        if (String(url).includes("oauth2/token")) {
          ++refreshes;
          return jsonResponse({
            access_token: `fixture-access-${refreshes}`,
            expires_in: 3600,
          });
        }
        ++reads;
        return reads === 1
          ? jsonResponse({}, 401)
          : jsonResponse({
              id: "user_1",
            });
      }),
    );
    const results = await Promise.all([
      stub.read("/v2/me/", {}),
      stub.read("/v2/me/", {}),
    ]);
    expect(results.every((result) => result.ok)).toBe(true);
    expect(refreshes).toBe(2);
    expect(reads).toBe(3);
  });
  it("removes a rejected refresh token so browser reconnect can relink", async () => {
    const stub = testSession();
    await seedSession(stub);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({}, 400)),
    );
    expect(await stub.read("/v2/me/", {})).toEqual({
      ok: false,
      kind: "authentication",
    });
    await evictDurableObject(stub);
    expect(await stub.status()).toEqual({
      logged_in: false,
    });
  });
  it("keeps credentials after a temporary token endpoint outage", async () => {
    const stub = testSession();
    await seedSession(stub);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({}, 503)),
    );
    expect(await stub.read("/v2/me/", {})).toEqual({
      ok: false,
      kind: "http",
      status: 503,
    });
    await evictDurableObject(stub);
    expect(await stub.status()).toEqual({
      logged_in: true,
    });
  });
  it("rejects a delayed login after logout", async () => {
    const stub = testSession();
    await runInDurableObject(stub, async (instance, state) => {
      let finish!: (token: string) => void;
      let started!: () => void;
      const pending = new Promise<string>((resolve) => {
        finish = resolve;
      });
      const submitted = new Promise<void>((resolve) => {
        started = resolve;
      });
      vi.mocked(createCognitoAuth).mockReturnValue({
        initiateCustomAuth: async () => ({
          challenge_name: "CUSTOM_CHALLENGE",
          challenge_session: "fixture-challenge",
        }),
        respondToAuthChallenge: async () => {
          started();
          return pending;
        },
      });
      const flowId = crypto.randomUUID();
      await instance.startLogin(flowId, false);
      const completing = instance.completeLogin(flowId, "123456").catch(() => "rejected");
      await submitted;
      await instance.logout();
      finish("fixture-refresh-token");
      expect(await completing).toBe("rejected");
      expect(await state.storage.get("session")).toBeUndefined();
    });
  });
  it("blocks a response arriving after logout", async () => {
    const stub = testSession();
    await seedSession(stub);
    await runInDurableObject(stub, async (instance) => {
      let finish!: (response: Response) => void;
      let started!: () => void;
      const pending = new Promise<Response>((resolve) => {
        finish = resolve;
      });
      const requested = new Promise<void>((resolve) => {
        started = resolve;
      });
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string | URL) => {
          if (String(url).includes("oauth2/token")) {
            return jsonResponse({
              access_token: "fixture-access-token",
              expires_in: 3600,
            });
          }
          started();
          return pending;
        }),
      );
      const read = instance.read("/v2/me/", {});
      await requested;
      await instance.logout();
      finish(
        jsonResponse({
          private: "never-return",
        }),
      );
      expect(await read).toEqual({
        ok: false,
        kind: "not_linked",
      });
    });
  });
});
