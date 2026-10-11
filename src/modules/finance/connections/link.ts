import { and, eq, lt } from "drizzle-orm";
import * as z from "zod";
import { encryptCredential } from "../../../common/utils/encryption.js";
import { ownerSession } from "../../../config/env.js";
import type { FinanceContext } from "../../../database/context.js";
import {
  assertConnectionRevision,
  requireConnection,
  saveConnection,
} from "../../../database/repositories/connections.js";
import { connections, links } from "../../../database/schema.js";
import { createPlaidClient } from "../../integrations/plaid/client.js";
import { createHostedLink, exchangeHostedLink } from "../../integrations/plaid/link.js";
import { createProvider } from "../../integrations/registry.js";
import type { Connection } from "../schemas.js";
import { providerCredential } from "./credentials.js";

export async function linkBenepass(context: FinanceContext): Promise<void> {
  if (!(await ownerSession(context.env).status()).logged_in) {
    throw new Error("Benepass is not signed in");
  }
  saveConnection(
    context.db,
    newConnection("benepass", "benepass", "Benepass", [
      "balances",
      "holdings",
    ]),
    null,
  );
}
export async function beginPlaidLink(
  context: FinanceContext,
  kind: "bank" | "investment",
  connectionId?: string,
): Promise<string> {
  z.enum([
    "bank",
    "investment",
  ]).parse(kind);
  z.string()
    .regex(/^[a-f0-9]{64}$/)
    .parse(context.env.DATA_KEY);
  const flowId = crypto.randomUUID();
  const connection = connectionId ? requireConnection(context.db, connectionId) : undefined;
  const token = connection ? await providerCredential(context, connection) : undefined;
  const link = await createHostedLink(
    createPlaidClient(context.env),
    context.env,
    flowId,
    kind,
    token,
  );
  context.db.delete(links).where(lt(links.expires_at, Date.now())).run();
  context.db
    .insert(links)
    .values({
      id: flowId,
      token: link.link_token,
      connection_id: connectionId ?? null,
      expires_at: Date.parse(link.expiration),
    })
    .run();
  return link.hosted_link_url;
}
export async function completePlaidLink(context: FinanceContext, flowId: string): Promise<void> {
  z.uuid().parse(flowId);
  const flow = context.db.select().from(links).where(eq(links.id, flowId)).get();
  if (!flow || flow.expires_at <= Date.now()) {
    throw new Error("Link expired");
  }
  if (flow.connection_id) {
    await completeUpdateMode(context, flow.connection_id);
  } else {
    await saveNewPlaidConnection(context, flow.token);
  }
  context.db.delete(links).where(eq(links.id, flowId)).run();
}
async function completeUpdateMode(context: FinanceContext, id: string): Promise<void> {
  const previous = requireConnection(context.db, id);
  const credential = await providerCredential(context, previous);
  await createProvider(context.env, previous, credential).readMetadata();
  assertConnectionRevision(context.db, previous);
  context.db
    .update(connections)
    .set({
      status: "connected",
      revision: crypto.randomUUID(),
    })
    .where(and(eq(connections.id, id), eq(connections.revision, previous.revision)))
    .run();
}
async function saveNewPlaidConnection(context: FinanceContext, linkToken: string): Promise<void> {
  const exchanged = await exchangeHostedLink(createPlaidClient(context.env), linkToken);
  const id = `plaid/${exchanged.item_id}`;
  const encrypted = await encryptCredential(context.env, id, exchanged.access_token);
  saveConnection(
    context.db,
    newConnection(id, "plaid", "Financial institution", [
      "balances",
    ]),
    encrypted,
  );
}
function newConnection(
  id: string,
  provider: Connection["provider"],
  institution: string,
  capabilities: Connection["capabilities"],
): Connection {
  return {
    id,
    provider,
    institution,
    capabilities,
    status: "connected",
    revision: crypto.randomUUID(),
    last_success_at: null,
    last_error: null,
  };
}
