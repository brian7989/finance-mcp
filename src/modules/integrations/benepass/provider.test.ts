import { env } from "cloudflare:workers";
import { ApiHttpError } from "../../../common/errors.js";
import { buildHsaSnapshot, readBenepassSnapshot } from "./provider.js";
import { HsaReader } from "./readers/hsa.js";

afterEach(() => {
  vi.restoreAllMocks();
});
function fixtureHsa(): Awaited<ReturnType<HsaReader["investments"]>> {
  return {
    account_id: "fixture-hsa",
    workspace_id: "fixture-workspace",
    fetched_at: new Date().toISOString(),
    status: "available",
    currency: "USD",
    cash: {
      amount: "100",
      formatted: "$100.00",
    },
    investments: {
      amount: "7003.09",
      formatted: "$7,003.09",
    },
    brokerage_cash: {
      amount: "0.02",
      formatted: "$0.02",
    },
    total: {
      amount: "7103.09",
      formatted: "$7,103.09",
    },
    pending_transfer_in: null,
    pending_transfer_out: null,
    availability_reason: null,
    valuation_note: "Fixture values",
    holdings_status: "available",
    holdings: [
      {
        asset_id: "fixture-asset",
        symbol: "TEST",
        asset_name: "Fixture fund",
        quantity: "10",
        market_value: "7003.07",
        market_value_formatted: "$7,003.07",
        current_price: "700.307",
        current_price_formatted: "$700.31",
        cost_basis: "6000",
        cost_basis_formatted: "$6,000.00",
        unrealized_profit_loss: "1003.07",
        unrealized_profit_loss_formatted: "$1,003.07",
        unrealized_profit_loss_percent: "0.167178",
      },
    ],
  };
}
describe("Benepass cash and investment accounts", () => {
  it("counts the two components once and attaches holdings only to investments", () => {
    const snapshot = buildHsaSnapshot(fixtureHsa(), "1234");
    expect(
      snapshot.accounts.map((account) => [
        account.name,
        account.mask,
      ]),
    ).toEqual([
      [
        "Benepass HSA Cash",
        "1234",
      ],
      [
        "Benepass HSA Investments",
        null,
      ],
    ]);
    expect(snapshot.balances.map((balance) => balance.current)).toEqual([
      "100",
      "7003.09",
    ]);
    expect(snapshot.balances[1]?.available).toBeNull();
    expect(snapshot.holdings?.[0]?.account_id).toBe(snapshot.accounts[1]?.id);
    expect(new Set(snapshot.accounts.map((account) => account.provider_account_id)).size).toBe(2);
  });
  it("rejects a split that disagrees with the provider total", () => {
    const hsa = fixtureHsa();
    hsa.total = {
      amount: "9999",
      formatted: "$9,999.00",
    };
    expect(() => buildHsaSnapshot(hsa, null)).toThrow("do not reconcile");
  });
  it("preserves known cash and leaves unavailable investments unknown", () => {
    const hsa = fixtureHsa();
    const snapshot = buildHsaSnapshot(
      {
        ...hsa,
        status: "partial",
        investments: null,
        total: null,
        holdings: null,
        holdings_status: "unavailable",
      },
      null,
    );
    expect(snapshot.balances[0]).toMatchObject({
      current: "100",
      completeness: "complete",
    });
    expect(snapshot.balances[1]).toMatchObject({
      current: null,
      completeness: "partial",
    });
    expect(snapshot.holdings).toBeNull();
  });
  it("retains only the last four account digits and does not invent an investment suffix", async () => {
    vi.spyOn(HsaReader.prototype, "investments").mockResolvedValue(fixtureHsa());
    vi.spyOn(HsaReader.prototype, "accountDetails").mockResolvedValue({
      account_number: "0000-1234-5678",
      routing_number: "fixture-routing",
      status: "active",
    });
    const snapshot = await readBenepassSnapshot(env);
    expect(snapshot.accounts[0]?.mask).toBe("5678");
    expect(snapshot.accounts[1]?.mask).toBeNull();
    expect(JSON.stringify(snapshot)).not.toContain("0000-1234-5678");
    expect(JSON.stringify(snapshot)).not.toContain("fixture-routing");
  });
  it("keeps balances usable when account details are unavailable", async () => {
    vi.spyOn(HsaReader.prototype, "investments").mockResolvedValue(fixtureHsa());
    vi.spyOn(HsaReader.prototype, "accountDetails").mockRejectedValue(
      new ApiHttpError(404, "fixture"),
    );
    const snapshot = await readBenepassSnapshot(env);
    expect(snapshot.accounts[0]?.mask).toBeNull();
    expect(snapshot.balances[0]?.current).toBe("100");
  });
});
