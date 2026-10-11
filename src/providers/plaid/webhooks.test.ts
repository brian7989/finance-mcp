import { env } from "cloudflare:workers";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { verifyPlaidWebhook } from "./webhooks.js";

afterEach(() => {
  vi.unstubAllGlobals();
});
describe("signed Plaid webhooks", () => {
  it("validates the signature, timestamp, and original body bytes", async () => {
    const pair = await generateKeyPair("ES256");
    const key = await exportJWK(pair.publicKey);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          key: {
            ...key,
            alg: "ES256",
            expired_at: null,
          },
        }),
      ),
    );
    const body = new TextEncoder().encode('{"webhook_type":"TRANSACTIONS","item_id":"fixture"}');
    const hash = Buffer.from(await crypto.subtle.digest("SHA-256", body)).toString("hex");
    const token = await new SignJWT({
      request_body_sha256: hash,
    })
      .setProtectedHeader({
        alg: "ES256",
        kid: "fixture-key",
      })
      .setIssuedAt()
      .sign(pair.privateKey);
    await expect(verifyPlaidWebhook(token, body, env)).resolves.toBeUndefined();
    await expect(
      verifyPlaidWebhook(token, new TextEncoder().encode("tampered"), env),
    ).rejects.toThrow();
    const stale = await new SignJWT({
      request_body_sha256: hash,
    })
      .setProtectedHeader({
        alg: "ES256",
        kid: "fixture-key",
      })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 600)
      .sign(pair.privateKey);
    await expect(verifyPlaidWebhook(stale, body, env)).rejects.toThrow();
    const otherPair = await generateKeyPair("ES256");
    const forged = await new SignJWT({
      request_body_sha256: hash,
    })
      .setProtectedHeader({
        alg: "ES256",
        kid: "fixture-key",
      })
      .setIssuedAt()
      .sign(otherPair.privateKey);
    await expect(verifyPlaidWebhook(forged, body, env)).rejects.toThrow();
  });
  it("rejects unsigned requests without contacting Plaid", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(verifyPlaidWebhook(null, new Uint8Array(), env)).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
});
