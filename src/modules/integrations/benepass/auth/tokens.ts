import { decodeJwt } from "jose";
import * as z from "zod";
import { ApiHttpError, AuthenticationError, SchemaError } from "../../../../common/errors.js";
import { fetchJson } from "../http.js";
import { CLIENT_ID, COGNITO_TOKEN_URL } from "./cognito.constants.js";

const TokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().positive().optional(),
});

export type AccessToken = {
  value: string;
  expiresAt: number;
};
export async function refreshAccessToken(refreshToken: string): Promise<AccessToken> {
  try {
    const payload = await requestAccessToken(refreshToken);
    const token = parseTokenResponse(payload);
    return {
      value: token.access_token,
      expiresAt: calculateExpiry(token.access_token, token.expires_in),
    };
  } catch (error) {
    if (error instanceof ApiHttpError && (error.status === 400 || error.status === 401)) {
      throw new AuthenticationError("Benepass session expired. Reconnect the connector.");
    }
    throw error;
  }
}
function parseTokenResponse(payload: unknown): z.infer<typeof TokenResponseSchema> {
  const result = TokenResponseSchema.safeParse(payload);
  if (!result.success) {
    throw new SchemaError("Invalid Benepass token response");
  }
  return result.data;
}
function requestAccessToken(refreshToken: string): Promise<unknown> {
  return fetchJson(COGNITO_TOKEN_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: CLIENT_ID,
      refresh_token: refreshToken,
    }),
  });
}
function calculateExpiry(accessToken: string, expiresIn?: number): number {
  const providerExpiry =
    expiresIn === undefined ? Date.now() + 50 * 60_000 : Date.now() + expiresIn * 1000;
  const jwtExpiry = readJwtExpiry(accessToken);
  const expiry = Math.min(providerExpiry, jwtExpiry ?? providerExpiry) - 30_000;
  if (expiry <= Date.now()) {
    throw new AuthenticationError("Benepass returned an expired token");
  }
  return expiry;
}
function readJwtExpiry(token: string): number | undefined {
  try {
    const expiry = decodeJwt(token).exp;
    return typeof expiry === "number" ? expiry * 1000 : undefined;
  } catch {
    return undefined;
  }
}
