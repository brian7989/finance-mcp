import type { Account, Balance, Preference } from "../schemas.js";
import { addAmounts, negateAmount } from "./money.js";

export function calculateNetWorth(
  accounts: Account[],
  balances: Balance[],
  preferences: Preference[],
) {
  const totals = new Map<string, string>();
  const missing: string[] = [];
  for (const account of accounts) {
    if (!shouldCountAccount(account, preferences)) {
      continue;
    }
    const balance = balances.find((value) => value.account_id === account.id);
    if (!isCountableBalance(balance)) {
      missing.push(account.id);
      continue;
    }
    addAccountValue(totals, account, balance);
  }
  return {
    totals: Array.from(totals, ([currency, amount]) => ({
      currency,
      amount,
    })),
    missing_account_ids: missing,
    complete: missing.length === 0,
  };
}
function shouldCountAccount(account: Account, preferences: Preference[]): boolean {
  const preference = preferences.find((value) => value.account_id === account.id);
  return account.active && (preference?.include_in_net_worth ?? true);
}
function netWorthAmount(account: Account, amount: string): string {
  if (account.type === "credit" || account.type === "loan") {
    return negateAmount(amount);
  }
  return amount;
}

type CountableBalance = Balance & {
  current: string;
  currency: string;
};
function isCountableBalance(balance: Balance | undefined): balance is CountableBalance {
  return (
    balance !== undefined &&
    balance.current !== null &&
    Boolean(balance.currency) &&
    balance.completeness === "complete"
  );
}
function addAccountValue(
  totals: Map<string, string>,
  account: Account,
  balance: CountableBalance,
): void {
  const current = totals.get(balance.currency) ?? "0";
  const amount = netWorthAmount(account, balance.current);
  totals.set(balance.currency, addAmounts(current, amount));
}
