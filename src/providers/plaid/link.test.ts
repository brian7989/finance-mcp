import { env } from "cloudflare:workers";
import type { PlaidClient } from "./client.js";
import { createHostedLink, exchangeHostedLink } from "./link.js";

describe("official Plaid Hosted Link", () => {
  it("uses existing access tokens for update mode instead of creating a replacement Item", async () => {
    const bodies: object[] = [];
    const client: PlaidClient = async (_path, body, schema) => {
      bodies.push(body);
      return schema.parse({
        link_token: "fixture-link",
        hosted_link_url: "https://secure.plaid.com/hl/fixture",
        expiration: "2026-10-10T12:00:00Z",
      });
    };
    await createHostedLink(client, env, crypto.randomUUID(), "bank", "fixture-existing-token");
    expect(bodies[0]).toMatchObject({
      access_token: "fixture-existing-token",
    });
    expect(bodies[0]).not.toHaveProperty("products");
  });
  it("rejects untrusted redirect origins", async () => {
    const client: PlaidClient = async (_path, _body, schema) =>
      schema.parse({
        link_token: "fixture",
        hosted_link_url: "https://attacker.example/hl/fixture",
        expiration: "2026-10-10T12:00:00Z",
      });
    await expect(createHostedLink(client, env, crypto.randomUUID(), "bank")).rejects.toThrow();
  });
  it("exchanges only server-retrieved results and rejects incomplete sessions", async () => {
    const paths: string[] = [];
    const client: PlaidClient = async (path, _body, schema) => {
      paths.push(path);
      if (path === "/link/token/get") {
        return schema.parse({
          link_sessions: [
            {
              results: {
                item_add_results: [
                  {
                    public_token: "fixture-public",
                  },
                ],
              },
            },
          ],
        });
      }
      return schema.parse({
        access_token: "fixture-access",
        item_id: "fixture-item",
      });
    };
    expect(await exchangeHostedLink(client, "fixture-link")).toMatchObject({
      item_id: "fixture-item",
    });
    expect(paths).toEqual([
      "/link/token/get",
      "/item/public_token/exchange",
    ]);
    const incomplete: PlaidClient = async (_path, _body, schema) =>
      schema.parse({
        link_sessions: [],
      });
    await expect(exchangeHostedLink(incomplete, "fixture-link")).rejects.toThrow();
  });
});
