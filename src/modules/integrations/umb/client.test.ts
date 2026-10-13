import * as z from "zod";
import { UMB_ORIGIN, UmbClient } from "./client.js";

afterEach(() => vi.restoreAllMocks());
describe("UMB portal boundary", () => {
  it("retains chunked session cookies between requests", async () => {
    const headers = new Headers({
      "content-type": "application/json",
    });
    headers.append("set-cookie", "sid=one; Path=/; Secure; HttpOnly");
    headers.append("set-cookie", "sidC1=two; Path=/; Secure; HttpOnly");
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response("[]", {
          headers,
        }),
      )
      .mockResolvedValueOnce(Response.json([]));
    const client = new UmbClient();
    await client.read("/Accounts/List", z.array(z.unknown()));
    const restored = new UmbClient(client.serialize());
    await restored.read("/Accounts/List", z.array(z.unknown()));
    const cookies = new Headers(fetcher.mock.calls[1]?.[1]?.headers).get("cookie");
    expect(cookies).toContain("sid=one");
    expect(cookies).toContain("sidC1=two");
  });
  it("refuses write routes and foreign destinations before sending cookies", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch");
    const client = new UmbClient();
    await expect(client.read("/Accounts/Transfer", z.unknown())).rejects.toThrow(
      "Unsupported UMB data route",
    );
    await expect(client.read("https://other.example/Accounts/List", z.unknown())).rejects.toThrow(
      "Unsupported UMB destination",
    );
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("rejects a foreign redirect without forwarding credentials", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: {
          location: "https://other.example/",
        },
      }),
    );
    await expect(
      new UmbClient().authenticate(
        "/Authentication/Handshake",
        new URLSearchParams({
          Password: "synthetic-only",
        }),
      ),
    ).rejects.toThrow("Unsupported UMB destination");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(String(fetcher.mock.calls[0]?.[0])).toBe(`${UMB_ORIGIN}/Authentication/Handshake`);
  });
  it("recognizes an expired session returned as a login page", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("<form>Sign in</form>", {
        headers: {
          "content-type": "text/html",
        },
      }),
    );
    await expect(new UmbClient().read("/Accounts/List", z.unknown())).rejects.toMatchObject({
      code: "UMB_SESSION_EXPIRED",
    });
  });
});
