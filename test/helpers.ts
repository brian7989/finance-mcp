import { runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import type { BenepassSession } from "../src/providers/benepass/session.js";

export function testSession(): DurableObjectStub<BenepassSession> {
  return env.BENEPASS_SESSION.getByName(crypto.randomUUID());
}
export async function seedSession(stub: DurableObjectStub<BenepassSession>): Promise<void> {
  await runInDurableObject(stub, async (_instance, state) => {
    const revision = crypto.randomUUID();
    await state.storage.put("revision", revision);
    await state.storage.put("session", {
      refreshToken: "fixture-refresh-token",
      revision,
    });
  });
}
export function jsonResponse(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
  });
}
