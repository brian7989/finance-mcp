import { runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { fixtureConnection } from "../../../../test/finance-fixtures.js";
import { createDatabase } from "../../../database/client.js";
import { saveConnection } from "../../../database/repositories/connections.js";
import { syncJobs } from "../../../database/schema.js";
import { processNextConnection, scheduleConnection } from "./scheduling.js";

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
