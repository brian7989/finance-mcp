import { env } from "cloudflare:workers";
import { createPlaidClient } from "./client.js";
import { createHostedLink, exchangeHostedLink, readItemDetails } from "./link.js";

afterEach(() => {
  vi.unstubAllGlobals();
});
function linkResponse(url = "https://secure.plaid.com/hl/fixture") {
  return {
    link_token: "fixture-link",
    hosted_link_url: url,
    expiration: "2026-10-10T12:00:00Z",
  };
}
describe("official Plaid SDK and Hosted Link", () => {
  it("starts one flow for banking and investment accounts", async () => {
    const bodies: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        bodies.push(await new Request(input, init).json());
        return Response.json(linkResponse());
      }),
    );
    await createHostedLink(createPlaidClient(env), env, crypto.randomUUID());
    expect(bodies[0]).toMatchObject({
      products: [
        "transactions",
      ],
      optional_products: [
        "investments",
      ],
      transactions: {
        days_requested: 730,
      },
    });
    expect(bodies[0]).not.toHaveProperty("access_token");
  });
  it.each([
    {
      products: [
        "investments",
      ],
      capabilities: [
        "balances",
        "holdings",
        "investment_activity",
      ],
    },
    {
      products: [
        "transactions",
        "investments",
      ],
      capabilities: [
        "balances",
        "transactions",
        "holdings",
        "investment_activity",
      ],
    },
  ])("reads enabled capabilities for $products", async ({ products, capabilities }) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = new URL(new Request(input, init).url).pathname;
        if (path === "/item/get") {
          return Response.json({
            item: {
              item_id: "fixture-item",
              institution_id: "fixture-institution",
              products,
              billed_products: products,
              available_products: [],
              consented_products: [
                "transactions",
                "investments",
              ],
            },
          });
        }
        return Response.json({
          institution: {
            name: "Fixture institution",
          },
        });
      }),
    );
    expect((await readItemDetails(createPlaidClient(env), "fixture-token")).capabilities).toEqual(
      capabilities,
    );
  });
  it("uses update mode without requesting a replacement Item", async () => {
    const bodies: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        bodies.push(await new Request(input, init).json());
        return Response.json(linkResponse());
      }),
    );
    await createHostedLink(
      createPlaidClient(env),
      env,
      crypto.randomUUID(),
      "fixture-existing-token",
    );
    expect(bodies[0]).toMatchObject({
      access_token: "fixture-existing-token",
      user: {
        client_user_id: env.FINANCE_STORE.idFromName(env.OWNER_EMAIL ?? "").toString(),
      },
    });
    expect(bodies[0]).not.toHaveProperty("products");
    expect(bodies[0]).not.toHaveProperty("optional_products");
  });
  it("does not treat consent for optional investments as product support", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = new URL(new Request(input, init).url).pathname;
        if (path === "/item/get") {
          return Response.json({
            item: {
              item_id: "fixture-item",
              institution_id: "fixture-bank",
              products: [
                "transactions",
              ],
              billed_products: [
                "transactions",
              ],
              available_products: [
                "balance",
              ],
              consented_products: [
                "transactions",
                "investments",
              ],
            },
          });
        }
        return Response.json({
          institution: {
            name: "Fixture cash account",
          },
        });
      }),
    );
    const details = await readItemDetails(createPlaidClient(env), "fixture-token");
    expect(details.capabilities).toEqual([
      "balances",
      "transactions",
    ]);
  });
  it("rejects untrusted redirect origins", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(linkResponse("https://attacker.example/hl/fixture"))),
    );
    await expect(
      createHostedLink(createPlaidClient(env), env, crypto.randomUUID()),
    ).rejects.toThrow();
  });
  it("exchanges only server-retrieved results", async () => {
    const paths: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = new URL(new Request(input, init).url).pathname;
        paths.push(path);
        if (path === "/link/token/get") {
          return Response.json({
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
        return Response.json({
          access_token: "fixture-access",
          item_id: "fixture-item",
        });
      }),
    );
    expect(await exchangeHostedLink(createPlaidClient(env), "fixture-link")).toMatchObject({
      item_id: "fixture-item",
    });
    expect(paths).toEqual([
      "/link/token/get",
      "/item/public_token/exchange",
    ]);
  });
});
