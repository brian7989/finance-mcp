import {
  fixtureAccount,
  fixtureBalance,
  fixtureConnection,
} from "../../../../test/finance-fixtures.js";
import { summarizeNetWorth } from "./queries.js";

describe("net-worth completeness and observation freshness", () => {
  const now = Date.parse("2026-10-10T12:00:00Z");
  const connected = {
    ...fixtureConnection(),
    last_success_at: "2026-10-10T09:17:00Z",
  };
  it("separates complete data from stale observations", () => {
    const result = summarizeNetWorth(
      [
        fixtureAccount(),
      ],
      [
        fixtureBalance(undefined, "100", "2026-10-01T00:00:00Z"),
      ],
      [],
      [
        connected,
      ],
      now,
    );
    expect(result.complete).toBe(true);
    expect(result.observations_fresh).toBe(false);
    expect(result.stale_account_ids).toEqual([
      fixtureAccount().id,
    ]);
  });
  it("excludes disconnected and explicitly excluded accounts from totals and freshness", () => {
    const other = {
      ...fixtureAccount("dad"),
      connection_id: "dad_connection",
    };
    const preferences = [
      {
        account_id: "dad",
        label: "Dad",
        include_in_net_worth: false,
        include_in_spending: false,
      },
    ];
    const result = summarizeNetWorth(
      [
        fixtureAccount(),
        other,
        {
          ...fixtureAccount("closed"),
          active: false,
        },
      ],
      [
        fixtureBalance(),
        fixtureBalance("dad", "99999"),
        fixtureBalance("closed", "99999"),
      ],
      preferences,
      [
        connected,
        {
          ...connected,
          id: "dad_connection",
          status: "disconnected",
        },
      ],
      now,
    );
    expect(result.totals).toEqual([
      {
        currency: "USD",
        amount: "100",
      },
    ]);
    expect(result.complete).toBe(true);
    expect(result.observations_fresh).toBe(true);
    expect(result.balance_observations).toHaveLength(1);
  });
  it("marks unknown balances and unsuccessful connections incomplete", () => {
    const result = summarizeNetWorth(
      [
        fixtureAccount(),
      ],
      [
        fixtureBalance(undefined, null),
      ],
      [],
      [
        {
          ...connected,
          last_error: "Provider unavailable",
        },
      ],
      now,
    );
    expect(result.complete).toBe(false);
    expect(result.observations_fresh).toBe(false);
  });
});
