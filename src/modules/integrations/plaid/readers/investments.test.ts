import { env } from "cloudflare:workers";
import { createPlaidClient } from "../client.js";
import { investmentWindow, readPlaidHoldings } from "./investments.js";

describe("investment history windows", () => {
  const now = Date.parse("2026-10-10T12:00:00Z");
  it("backfills two years once, then overlaps recent history for corrections", () => {
    const initial = investmentWindow(null, now);
    const incremental = investmentWindow("2026-10-09T12:00:00Z", now);
    expect(Date.parse(initial.end_date) - Date.parse(initial.start_date)).toBe(730 * 86400000);
    expect(Date.parse(incremental.end_date) - Date.parse(incremental.start_date)).toBe(
      91 * 86400000,
    );
  });
  it("backfills missed periods without requesting more than two years", () => {
    const window = investmentWindow("2020-01-01T12:00:00Z", now);
    expect(window).toEqual(investmentWindow(null, now));
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});
function fixtureLot(account: string, quantity: number, value: number, currency = "USD") {
  return {
    account_id: account,
    security_id: "fixture-security",
    quantity,
    institution_value: value,
    institution_price_as_of: "2026-10-10",
    iso_currency_code: currency,
    unofficial_currency_code: null,
  };
}
function stubHoldings(lots: ReturnType<typeof fixtureLot>[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        accounts: [],
        holdings: lots,
        securities: [
          {
            security_id: "fixture-security",
            name: "Fixture stock",
            ticker_symbol: "TEST",
          },
        ],
      }),
    ),
  );
}
describe("Plaid holding lots", () => {
  it("combines lots of the same security without merging different accounts", async () => {
    stubHoldings([
      fixtureLot("stock-plan", 0.1, 10.1),
      fixtureLot("stock-plan", 0.2, 20.2),
      fixtureLot("brokerage", 2, 200),
    ]);
    const holdings = await readPlaidHoldings(
      createPlaidClient(env),
      "fixture-token",
      "plaid/fixture",
    );
    expect(holdings).toHaveLength(2);
    expect(holdings[0]).toMatchObject({
      quantity: "0.3",
      value: "30.3",
      account_id: "plaid/fixture/stock-plan",
    });
    expect(holdings[1]).toMatchObject({
      quantity: "2",
      value: "200",
      account_id: "plaid/fixture/brokerage",
    });
    expect(new Set(holdings.map((holding) => holding.id)).size).toBe(2);
  });
  it("rejects combining lots in different currencies", async () => {
    stubHoldings([
      fixtureLot("stock-plan", 1, 10),
      fixtureLot("stock-plan", 1, 10, "CAD"),
    ]);
    await expect(
      readPlaidHoldings(createPlaidClient(env), "fixture-token", "plaid/fixture"),
    ).rejects.toThrow("inconsistent currencies");
  });
});
