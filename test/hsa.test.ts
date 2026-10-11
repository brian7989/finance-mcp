import { BenepassClient } from "../src/providers/benepass/client.js";
import { HsaReader } from "../src/providers/benepass/hsa/hsa.js";
import { employeeHeaders, employeeUrl } from "../src/providers/benepass/http.js";

function jsonResponse(status: number, data: unknown): Response {
  return Response.json(data, {
    status,
  });
}
const balance = {
  id: "portfolio_1",
  currency: "USD",
  balance: "2345.67",
  balance_formatted: "$2,345.67",
  cash_balance: "0.02",
  cash_balance_formatted: "$0.02",
  account_balance: "125.00",
  account_balance_formatted: "$125.00",
  total_value: "2470.67",
  total_value_formatted: "$2,470.67",
  pending_transfer_in: null,
  pending_transfer_out: null,
};

async function withHsa(
  fn: (hsa: HsaReader, calls: Request[]) => Promise<void>,
  status = 200,
  payload: unknown = balance,
  cash?: string,
  positionsStatus = 200,
) {
  const calls: Request[] = [];
  const respond = async (input: Request) => {
    const request = input;
    calls.push(request);
    if (request.url.includes("/oauth2/token")) {
      return jsonResponse(200, {
        access_token: "fake-access",
        expires_in: 3600,
      });
    }
    if (new URL(request.url).pathname === "/v2/me/workspaces/") {
      return jsonResponse(200, {
        data: [
          {
            id: "ws_employment",
            type: "employment",
          },
          {
            id: "ws_personal",
            type: "user",
          },
        ],
      });
    }
    if (new URL(request.url).pathname === "/v2/me/hsa-account-details/") {
      return jsonResponse(200, {
        account_number: "fake-account-number",
        routing_number: "fake-routing-number",
        status: "active",
      });
    }
    if (new URL(request.url).pathname === "/v2/me/accounts/") {
      return jsonResponse(200, {
        data: [
          {
            id: "account_hsa",
            balances:
              cash === undefined
                ? []
                : [
                    {
                      key: "hsa/available",
                      amount: cash,
                      formatted_local_amount: "$125.00",
                    },
                  ],
            type: "user/pretax",
            key: "user/hsa",
            enrollment: {
              benefit: {
                id: "benefit_hsa",
                benefit_type: "HEALTH_SAVINGS",
              },
              local_max_expense_amount: null,
              max_expense_amount: null,
            },
          },
        ],
      });
    }
    if (request.url.includes("/positions/")) {
      return jsonResponse(positionsStatus, {
        data: [
          {
            asset_id: "asset_1",
            symbol: "VTI",
            asset_name: "Example fund",
            quantity: "12.3456789",
            market_value: "2345.65",
            market_value_formatted: "$2,345.65",
            current_price: "190.00",
            current_price_formatted: "$190.00",
            cost_basis: "2300.00",
            cost_basis_formatted: "$2,300.00",
            unrealized_profit_loss: "45.65",
            unrealized_profit_loss_formatted: "$45.65",
            unrealized_profit_loss_percent: "0.019847826",
          },
        ],
      });
    }
    return jsonResponse(status, payload);
  };
  const api = new BenepassClient({
    async read(path, options) {
      const request = new Request(employeeUrl(path, options.query), {
        headers: employeeHeaders("fixture-access", options.workspaceId),
      });
      const response = await respond(request);
      if (!response.ok) {
        return {
          ok: false as const,
          kind: "http" as const,
          status: response.status,
        };
      }
      return {
        ok: true as const,
        data: await response.json(),
      };
    },
  });
  await fn(new HsaReader(api), calls);
}
describe("HSA contracts", () => {
  it("keeps decimal values and uses provider total without double counting brokerage cash", async () => {
    await withHsa(async (hsa, calls) => {
      const result = await hsa.investments({
        account_id: "account_hsa",
        workspace_id: "ws_1",
      });
      expect(result.cash?.amount).toBe("125.00");
      expect(result.investments?.amount).toBe("2345.67");
      expect(result.brokerage_cash?.amount).toBe("0.02");
      expect(result.total?.amount).toBe("2470.67");
      expect(result.holdings?.[0]).toMatchObject({
        symbol: "VTI",
        quantity: "12.3456789",
        market_value: "2345.65",
      });
      const api = calls.filter((call) => new URL(call.url).hostname === "api.benefitsapi.com");
      expect(api.map((call) => new URL(call.url).pathname)).toEqual([
        "/v2/me/accounts/account_hsa/hsa-investments/portfolio/balance/",
        "/v2/me/accounts/account_hsa/hsa-investments/portfolio/positions/",
      ]);
      expect(api.every((call) => call.method === "GET")).toBe(true);
    });
  });
  it("automatically discovers the personal HSA workspace and keeps holdings in that scope", async () => {
    await withHsa(async (hsa, calls) => {
      const result = await hsa.investments({});
      expect(result.workspace_id).toBe("ws_personal");
      expect(result.account_id).toBe("account_hsa");
      expect(result.holdings_status).toBe("available");
      const scoped = calls.filter((call) =>
        new URL(call.url).pathname.startsWith("/v2/me/accounts/"),
      );
      expect(scoped).toHaveLength(3);
      expect(
        scoped.every((call) => call.headers.get("x-benepass-workspace-id") === "ws_personal"),
      ).toBe(true);
    });
  });

  it("reads HSA banking details from the personal workspace by default", async () => {
    await withHsa(async (hsa, calls) => {
      expect(await hsa.accountDetails({})).toMatchObject({
        status: "active",
      });
      const details = calls.find(
        (call) => new URL(call.url).pathname === "/v2/me/hsa-account-details/",
      );
      expect(details?.headers.get("x-benepass-workspace-id")).toBe("ws_personal");
    });
  });

  it("does not substitute allocation data for malformed balance data", async () => {
    await withHsa(
      async (hsa) => {
        await expect(
          hsa.summary({
            account_id: "account_hsa",
            workspace_id: "ws_1",
          }),
        ).rejects.toThrow(/Unexpected HSA/);
      },
      200,
      {
        weights: [],
        refresh_token: "fake-secret",
      },
    );
  });
  it("reports 404 as unavailable, with unknown balances rather than zero", async () => {
    await withHsa(async (hsa) => {
      expect(
        await hsa.summary({
          account_id: "account_hsa",
          workspace_id: "ws_1",
        }),
      ).toMatchObject({
        status: "unavailable",
        total: null,
        investments: null,
      });
    }, 404);
  });
  it("preserves independently reported cash when investments return 404", async () => {
    await withHsa(
      async (hsa, calls) => {
        const result = await hsa.investments({
          account_id: "account_hsa",
          workspace_id: "ws_1",
        });
        expect(result).toMatchObject({
          status: "partial",
          cash: {
            amount: "125.00",
            formatted: "$125.00",
          },
          currency: null,
          investments: null,
          total: null,
          holdings: null,
          holdings_status: "unavailable",
        });
        expect(calls.some((call) => call.url.includes("/positions/"))).toBe(false);
      },
      404,
      {},
      "125.00",
    );
  });
  it("preserves balances when only holdings return 404", async () => {
    await withHsa(
      async (hsa) => {
        expect(
          await hsa.investments({
            account_id: "account_hsa",
            workspace_id: "ws_1",
          }),
        ).toMatchObject({
          status: "available",
          cash: {
            amount: "125.00",
          },
          total: {
            amount: "2470.67",
          },
          holdings: null,
          holdings_status: "unavailable",
        });
      },
      200,
      balance,
      undefined,
      404,
    );
  });
  it("rejects malformed fallback cash instead of returning an invalid money value", async () => {
    await withHsa(
      async (hsa) => {
        await expect(
          hsa.summary({
            account_id: "account_hsa",
            workspace_id: "ws_1",
          }),
        ).rejects.toThrow(/cash balance/);
      },
      404,
      {},
      "not-money",
    );
  });
  it("propagates outage and authorization errors", async () => {
    for (const status of [
      403,
      500,
    ]) {
      await withHsa(async (hsa) => {
        await expect(
          hsa.summary({
            account_id: "account_hsa",
            workspace_id: "ws_1",
          }),
        ).rejects.toMatchObject({
          status,
        });
      }, status);
    }
  });
  it("rejects traversal identifiers before fetch", async () => {
    await withHsa(async (hsa, calls) => {
      await expect(
        hsa.summary({
          account_id: "..",
        }),
      ).rejects.toThrow();
      expect(calls).toHaveLength(0);
    });
  });
});
