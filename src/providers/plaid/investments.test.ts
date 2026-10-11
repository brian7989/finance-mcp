import { investmentWindow } from "./investments.js";

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
