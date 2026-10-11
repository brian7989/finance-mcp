import { timingSafeEqual } from "node:crypto";
import { decodeProtectedHeader, importJWK, jwtVerify } from "jose";
import * as z from "zod";
import { type Env, ownerStore } from "../../config.js";
import { readBoundedBody } from "../../web/request-body.js";
import { createPlaidClient, readPlaidResponse } from "./client.js";

const KeySchema = z.object({
  key: z.object({
    kty: z.literal("EC"),
    alg: z.literal("ES256"),
    crv: z.literal("P-256"),
    x: z.string(),
    y: z.string(),
    expired_at: z.number().nullable(),
  }),
});
const ClaimsSchema = z.object({
  request_body_sha256: z.string().regex(/^[a-f0-9]{64}$/),
});
const WebhookSchema = z.object({
  webhook_type: z.string(),
  webhook_code: z.string(),
  item_id: z.string().optional(),
});

export async function handlePlaidWebhook(request: Request, env: Env): Promise<Response> {
  try {
    const body = await readBoundedBody(request, 65536);
    await verifyPlaidWebhook(request.headers.get("plaid-verification"), body, env);
    const webhook = WebhookSchema.parse(JSON.parse(new TextDecoder().decode(body)));
    const store = ownerStore(env);
    if (webhook.item_id) {
      const connections = await store.connections();
      const id = `plaid/${webhook.item_id}`;
      const connection = connections.connections.find((value) => value.id === id);
      if (connection?.status === "connected") {
        await store.scheduleConnectionSync(id);
      }
    }
    return Response.json({
      received: true,
    });
  } catch {
    return new Response("Webhook rejected", {
      status: 400,
    });
  }
}
export async function verifyPlaidWebhook(
  token: string | null,
  body: Uint8Array,
  env: Env,
): Promise<void> {
  if (!token) {
    throw new Error("Missing webhook signature");
  }
  const header = decodeProtectedHeader(token);
  if (header.alg !== "ES256" || !header.kid) {
    throw new Error("Invalid webhook algorithm");
  }
  const data = await readPlaidResponse(
    KeySchema,
    createPlaidClient(env).webhookVerificationKeyGet({
      key_id: header.kid,
    }),
  );
  if (data.key.expired_at !== null) {
    throw new Error("Expired webhook key");
  }
  const key = await importJWK(data.key, "ES256");
  const result = await jwtVerify(token, key, {
    algorithms: [
      "ES256",
    ],
    requiredClaims: [
      "iat",
    ],
    maxTokenAge: "5m",
  });
  const claims = ClaimsSchema.parse(result.payload);
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(body));
  if (!timingSafeEqual(Buffer.from(digest), Buffer.from(claims.request_body_sha256, "hex"))) {
    throw new Error("Webhook body mismatch");
  }
}
