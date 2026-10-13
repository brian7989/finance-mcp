import { UmbTransactionSchema } from "../schemas.js";
import { mapUmbTransaction } from "./transactions.js";

it.each([
  -12.34,
  0.01,
  100,
])("preserves signed UMB amounts: %s", (amount) => {
  const item = UmbTransactionSchema.parse({
    Id: "synthetic-transaction",
    AccountId: 123,
    AccountIsHsa: true,
    Date: "2026-01-02T23:30:00",
    Description: "Synthetic transaction",
    Type: "Card",
    Amount: amount,
    IsDenied: false,
    IsPending: false,
    Claimant: "must not escape",
  });
  const transaction = mapUmbTransaction(item, "2026-01-03T00:00:00Z");
  expect(transaction.amount).toBe(String(amount));
  expect(transaction.date).toBe("2026-01-02");
  expect(transaction.account_id).toBe("umb/123/cash");
  expect(transaction).not.toHaveProperty("Claimant");
});
