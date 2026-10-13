import { ConnectionSchema } from "../../../finance/schemas.js";
import { UmbAccountSchema } from "../schemas.js";
import { mapUmbAccounts } from "./accounts.js";

const connection = ConnectionSchema.parse({
  id: "umb",
  provider: "umb",
  institution: "UMB HSA",
  country: "US",
  status: "connected",
  capabilities: [
    "balances",
    "transactions",
  ],
  revision: "test-revision",
  last_success_at: null,
  last_error: null,
});
const account = UmbAccountSchema.parse({
  AccountId: 123,
  AccountName: "HSA",
  ReassociationAcctNum: "*****4321",
  IsHsa: true,
  Active: true,
  HideDollarAmount: false,
  TotalBalance: 1000.25,
  AvailableBalance: 700.25,
  PortfolioBalance: 300,
  InvestmentAccountId: "investment-fixture",
});
const fetchedAt = "2026-01-01T00:00:00Z";

describe("UMB balances", () => {
  it("splits the combined total without double counting", () => {
    const snapshot = mapUmbAccounts(
      [
        account,
      ],
      connection,
      fetchedAt,
    );
    expect(snapshot.balances.map((balance) => balance.current)).toEqual([
      "700.25",
      "300",
    ]);
    expect(snapshot.accounts.map((item) => item.mask)).toEqual([
      "4321",
      "4321",
    ]);
    expect(snapshot.holdings).toBeNull();
  });
  it("does not invent an investment account when unenrolled", () => {
    const snapshot = mapUmbAccounts(
      [
        {
          ...account,
          InvestmentAccountId: null,
          PortfolioBalance: 0,
        },
      ],
      connection,
      fetchedAt,
    );
    expect(snapshot.accounts).toHaveLength(1);
    expect(snapshot.balances[0]?.current).toBe("1000.25");
  });
  it("preserves hidden balances as unknown", () => {
    const snapshot = mapUmbAccounts(
      [
        {
          ...account,
          HideDollarAmount: true,
        },
      ],
      connection,
      fetchedAt,
    );
    expect(snapshot.balances.every((balance) => balance.current === null)).toBe(true);
  });
  it("rejects inconsistent totals instead of understating net worth", () => {
    expect(() =>
      mapUmbAccounts(
        [
          {
            ...account,
            PortfolioBalance: 2000,
          },
        ],
        connection,
        fetchedAt,
      ),
    ).toThrow("Inconsistent UMB balances");
  });
  it("excludes non-HSA accounts and preserves inactive status", () => {
    const snapshot = mapUmbAccounts(
      [
        {
          ...account,
          IsHsa: false,
        },
        {
          ...account,
          Active: false,
        },
      ],
      connection,
      fetchedAt,
    );
    expect(snapshot.accounts.every((item) => !item.active)).toBe(true);
    expect(snapshot.accounts).toHaveLength(2);
  });
});
