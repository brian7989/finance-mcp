import { and, eq, sql } from "drizzle-orm";
import type { FinanceContext } from "../../../database/context.js";
import {
  listStoredConnections,
  requireConnection,
} from "../../../database/repositories/connections.js";
import { syncJobs } from "../../../database/schema.js";

export async function scheduleAllConnections(context: FinanceContext): Promise<void> {
  const connections = listStoredConnections(context.db).filter(
    (value) => value.status === "connected",
  );
  context.storage.transactionSync(() => {
    for (const connection of connections) {
      enqueueConnection(context, connection.id);
    }
  });
  await ensureAlarm(context);
}
export async function scheduleConnection(context: FinanceContext, id: string): Promise<void> {
  const connection = requireConnection(context.db, id);
  if (connection.status !== "connected") {
    return;
  }
  enqueueConnection(context, id);
  await ensureAlarm(context);
}
export async function processNextConnection(
  context: FinanceContext,
  refresh: (id: string) => Promise<unknown>,
): Promise<void> {
  const job = context.db.select().from(syncJobs).orderBy(syncJobs.connection_id).get();
  if (!job) {
    return;
  }
  await refresh(job.connection_id);
  // A webhook received during the refresh advances generation and must get another run.
  context.db
    .delete(syncJobs)
    .where(
      and(eq(syncJobs.connection_id, job.connection_id), eq(syncJobs.generation, job.generation)),
    )
    .run();
  await ensureAlarm(context);
}
function enqueueConnection(context: FinanceContext, id: string): void {
  context.db
    .insert(syncJobs)
    .values({
      connection_id: id,
      generation: 1,
    })
    .onConflictDoUpdate({
      target: syncJobs.connection_id,
      set: {
        generation: sql`${syncJobs.generation} + 1`,
      },
    })
    .run();
}
async function ensureAlarm(context: FinanceContext): Promise<void> {
  const pending = context.db.select().from(syncJobs).limit(1).get();
  if (pending) {
    await context.storage.setAlarm(Date.now() + 30000);
  }
}
