import { runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { fixtureConnection } from "../../../../test/finance-fixtures.js";
import { createDatabase } from "../../../database/client.js";
import { saveConnection } from "../../../database/repositories/connections.js";
import { syncJobs } from "../../../database/schema.js";
import { isPacificMidnight, processNextConnection, scheduleConnection } from "./scheduling.js";

describe("durable refresh jobs", () => {
  it("keeps a notification received during a refresh queued for another run", async () => {
    const stub = env.FINANCE_STORE.getByName(crypto.randomUUID());
    await runInDurableObject(stub, async (_instance, state) => {
      const db = createDatabase(state.storage);
      const context = {
        db,
        storage: state.storage,
        env,
      };
      saveConnection(db, fixtureConnection(), null);
      await scheduleConnection(context, "plaid/item_1");
      await processNextConnection(context, async () => {
        await scheduleConnection(context, "plaid/item_1");
      });
      expect(db.select().from(syncJobs).all()).toHaveLength(1);
      await processNextConnection(context, async () => undefined);
      expect(db.select().from(syncJobs).all()).toHaveLength(0);
    });
  });
});

describe("midnight Pacific schedule", () => {
  it.each([
    [
      "2026-01-15T08:00:00Z",
      true,
    ],
    [
      "2026-01-15T07:00:00Z",
      false,
    ],
    [
      "2026-07-15T07:00:00Z",
      true,
    ],
    [
      "2026-07-15T08:00:00Z",
      false,
    ],
    [
      "2026-03-08T08:00:00Z",
      true,
    ],
    [
      "2026-03-08T07:00:00Z",
      false,
    ],
    [
      "2026-11-01T07:00:00Z",
      true,
    ],
    [
      "2026-11-01T08:00:00Z",
      false,
    ],
  ])("checks %s without triggering a second daily refresh", (timestamp, expected) => {
    expect(isPacificMidnight(Date.parse(timestamp))).toBe(expected);
  });
});
