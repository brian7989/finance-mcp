import { env } from "cloudflare:workers";
import * as z from "zod";
import { createPlaidClient, readPlaidResponse } from "./client.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Plaid transport boundaries", () => {
  it("does not follow API redirects with credentials", async () => {
    const requests: Request[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        requests.push(new Request(input, init));
        return new Response(null, {
          status: 302,
          headers: {
            location: "https://untrusted.example",
          },
        });
      }),
    );
    const client = createPlaidClient(env);
    await expect(
      readPlaidResponse(
        z.object({}),
        client.itemGet({
          access_token: "fixture-access",
        }),
      ),
    ).rejects.toThrow("Plaid request failed");
    expect(requests).toHaveLength(1);
    expect(requests[0]?.redirect).toBe("manual");
    expect(new URL(requests[0]?.url ?? "").hostname).toBe("sandbox.plaid.com");
  });
  it("does not expose request secrets or provider response details in errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          {
            error_code: "ITEM_LOGIN_REQUIRED",
            error_message: "fixture-private-detail",
          },
          {
            status: 400,
          },
        ),
      ),
    );
    const client = createPlaidClient(env);
    try {
      await readPlaidResponse(
        z.object({}),
        client.itemGet({
          access_token: "fixture-private-token",
        }),
      );
      throw new Error("Expected request failure");
    } catch (error) {
      expect(error).toMatchObject({
        code: "ITEM_LOGIN_REQUIRED",
        message: "Plaid request failed",
      });
      expect(String(error)).not.toContain("fixture-private");
      expect(JSON.stringify(error)).not.toContain("fixture-private");
    }
  });
});
