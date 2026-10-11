import { eq, lt } from "drizzle-orm";
import type { FinanceDatabase } from "../client.js";
import { links } from "../schema.js";

type StoredLink = typeof links.$inferSelect;

export function saveLink(db: FinanceDatabase, flow: StoredLink): void {
  db.delete(links).where(lt(links.expires_at, Date.now())).run();
  db.insert(links).values(flow).run();
}
export function requireValidLink(db: FinanceDatabase, id: string): StoredLink {
  const flow = db.select().from(links).where(eq(links.id, id)).get();
  if (!flow || flow.expires_at <= Date.now()) {
    throw new Error("Link expired");
  }
  return flow;
}
export function removeLink(db: FinanceDatabase, id: string): void {
  db.delete(links).where(eq(links.id, id)).run();
}
