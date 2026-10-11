import { EncryptJWT, jwtDecrypt } from "jose";
import * as z from "zod";
import type { Env } from "../config.js";

export async function encryptCredential(
  env: Env,
  connectionId: string,
  token: string,
): Promise<string> {
  return new EncryptJWT({
    token,
  })
    .setProtectedHeader({
      alg: "dir",
      enc: "A256GCM",
    })
    .setAudience(connectionId)
    .encrypt(dataKey(env));
}
export async function decryptCredential(
  env: Env,
  connectionId: string,
  encrypted: string,
): Promise<string> {
  const { payload } = await jwtDecrypt(encrypted, dataKey(env), {
    audience: connectionId,
    keyManagementAlgorithms: [
      "dir",
    ],
    contentEncryptionAlgorithms: [
      "A256GCM",
    ],
  });
  return z.string().min(1).parse(payload.token);
}
function dataKey(env: Env): Uint8Array {
  const key = z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .parse(env.DATA_KEY);
  return Uint8Array.from(key.match(/../g) ?? [], (value) => Number.parseInt(value, 16));
}
