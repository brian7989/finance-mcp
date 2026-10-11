import { AccountSchema } from "../schemas/accounts.js";
import { availableBalance, isHsaAccount } from "./accounts.js";

describe("account and benefit schemas", () => {
  it("accepts a typical account payload", () => {
    const parsed = AccountSchema.parse({
      id: "acc_1",
      key: "commuter",
      enrollment: {
        benefit: {
          id: "ben_1",
          name: "Commuter",
          benefit_type: "commuter",
        },
        local_max_expense_amount: "50.00",
      },
      balances: [
        {
          key: "commuter/available",
          amount: "120.00",
          formatted_local_amount: "$120.00",
        },
      ],
    });
    expect(parsed.id).toBe("acc_1");
    expect(parsed.enrollment?.benefit?.id).toBe("ben_1");
  });

  it("rejects an account without id", () => {
    const result = AccountSchema.safeParse({
      enrollment: {
        benefit: {
          id: "ben_1",
        },
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a benefit without id", () => {
    const result = AccountSchema.safeParse({
      id: "acc_1",
      enrollment: {
        benefit: {
          name: "No id",
        },
      },
    });
    expect(result.success).toBe(false);
  });

  it("prefers primary HSA cash over reimbursement balances", () => {
    expect(
      availableBalance([
        {
          key: "hsa/reimbursement/available",
          amount: "1",
        },
        {
          key: "hsa/available",
          amount: "900.00",
        },
      ])?.amount,
    ).toBe("900.00");
  });

  it("accepts null spending limits returned by live accounts", () => {
    const account = AccountSchema.parse({
      id: "account_1",
      enrollment: {
        benefit: {
          id: "benefit_1",
          benefit_type: "HEALTH_SAVINGS",
        },
        max_expense_amount: null,
        local_max_expense_amount: null,
      },
    });
    expect(isHsaAccount(account)).toBe(true);
  });

  it("selects HSA accounts from typed fields, not names", () => {
    const hsa = AccountSchema.parse({
      id: "acc_hsa",
      name: "Wellness stipend",
      enrollment: {
        benefit: {
          id: "b",
          benefit_type: "HSA",
        },
      },
    });
    const named = AccountSchema.parse({
      id: "acc_named",
      name: "My HSA investment account",
      enrollment: {
        benefit: {
          id: "b2",
          benefit_type: "fsa",
        },
      },
    });
    expect(isHsaAccount(hsa)).toBe(true);
    expect(isHsaAccount(named)).toBe(false);
  });
});
