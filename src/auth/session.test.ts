import { env } from "cloudflare:workers";
import { readConfiguration } from "../config.js";
import { assertSameOrigin } from "./browser.js";
import { assertAllowedIdentity } from "./identity.js";
import { assertOwnerCsrf, requireOwnerSession, saveOwnerSession } from "./session.js";

describe("owner-only browser access", () => {
  it("requires a signed session and binds it to the configured owner", async () => {
    const configuration = readConfiguration(env);
    const headers = new Headers();
    await saveOwnerSession(headers, "fixture-owner", configuration);
    const cookie = headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
    const request = new Request(`${configuration.PUBLIC_ORIGIN}/connections`, {
      headers: {
        cookie,
      },
    });
    const owner = await requireOwnerSession(request, configuration);
    expect(owner.email).toBe(configuration.OWNER_EMAIL);
    await expect(requireOwnerSession(new Request(request.url), configuration)).rejects.toThrow();
    await expect(
      requireOwnerSession(request, {
        ...configuration,
        OWNER_EMAIL: "other@example.com",
      }),
    ).rejects.toThrow();
    expect(() =>
      assertOwnerCsrf(
        new URLSearchParams({
          csrf: owner.csrf,
        }),
        owner,
      ),
    ).not.toThrow();
    expect(() =>
      assertOwnerCsrf(
        new URLSearchParams({
          csrf: "wrong",
        }),
        owner,
      ),
    ).toThrow();
    expect(headers.get("set-cookie")).toContain("Secure; HttpOnly; SameSite=Lax");
  });
  it("rejects form submissions from another origin and unverified identities", () => {
    const configuration = readConfiguration(env);
    expect(() =>
      assertSameOrigin(
        new Request(configuration.PUBLIC_ORIGIN, {
          headers: {
            origin: "https://attacker.example",
          },
        }),
        configuration,
      ),
    ).toThrow();
    const identity = {
      sub: "owner",
      email: configuration.OWNER_EMAIL,
      email_verified: true,
      nonce: "nonce",
    };
    expect(() => assertAllowedIdentity(identity, "nonce", configuration.OWNER_EMAIL)).not.toThrow();
    expect(() =>
      assertAllowedIdentity(
        {
          ...identity,
          email_verified: false,
        },
        "nonce",
        configuration.OWNER_EMAIL,
      ),
    ).toThrow();
    expect(() =>
      assertAllowedIdentity(identity, "other-nonce", configuration.OWNER_EMAIL),
    ).toThrow();
    expect(() =>
      assertAllowedIdentity(
        {
          ...identity,
          email: "other@example.com",
        },
        "nonce",
        configuration.OWNER_EMAIL,
      ),
    ).toThrow();
  });
});
