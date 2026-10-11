import { fixtureAccount, fixtureBalance } from "../../test/finance-fixtures.js";
import { addAmounts, decimal, negateAmount } from "./money.js";
import { calculateNetWorth } from "./net-worth.js";

describe("money and personal net worth", () => {
  it("adds decimals without floating-point drift", () => {
    expect(addAmounts("0.1", "0.2")).toBe("0.3");
    expect(addAmounts("9007199254740993.01", "0.02")).toBe("9007199254740993.03");
    expect(addAmounts("-2.5", "1.25")).toBe("-1.25");
    expect(negateAmount("-0.00")).toBe("0");
    expect(decimal(1e-7)).toBe("0.0000001");
    expect(decimal(null)).toBeNull();
    expect(() => decimal(Number.NaN)).toThrow();
  });
  it("subtracts debt, keeps currencies separate, and applies exclusions", () => {
    const accounts = [
      fixtureAccount("cash"),
      fixtureAccount("credit", "credit"),
      fixtureAccount("dad", "investment"),
      fixtureAccount("canada"),
    ];
    const balances = [
      fixtureBalance("cash", "1000.1"),
      fixtureBalance("credit", "100.2"),
      fixtureBalance("dad", "99999"),
      {
        ...fixtureBalance("canada", "50"),
        currency: "CAD",
      },
    ];
    const result = calculateNetWorth(accounts, balances, [
      {
        account_id: "dad",
        label: "Dad",
        include_in_net_worth: false,
        include_in_spending: false,
      },
    ]);
    expect(result.totals).toEqual([
      {
        currency: "USD",
        amount: "899.9",
      },
      {
        currency: "CAD",
        amount: "50",
      },
    ]);
    expect(result.complete).toBe(true);
  });
  it("identifies unknown and partial balances instead of inventing zeros", () => {
    const accounts = [
      fixtureAccount("unknown"),
      fixtureAccount("partial", "hsa"),
      fixtureAccount("known"),
    ];
    const balances = [
      {
        ...fixtureBalance("partial", "100"),
        completeness: "partial" as const,
      },
      fixtureBalance("known", "50"),
    ];
    const result = calculateNetWorth(accounts, balances, []);
    expect(result.missing_account_ids).toEqual([
      "unknown",
      "partial",
    ]);
    expect(result.totals).toEqual([
      {
        currency: "USD",
        amount: "50",
      },
    ]);
    expect(result.complete).toBe(false);
  });
});
