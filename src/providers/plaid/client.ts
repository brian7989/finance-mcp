import * as z from "zod";
import type { Env } from "../../config.js";

export class PlaidError extends Error {
  constructor(readonly code: string) {
    super("Plaid request failed");
  }
}
const ErrorSchema = z.object({
  error_code: z.string(),
});

export function createPlaidClient(env: Env) {
  const clientId = z.string().min(1).parse(env.PLAID_CLIENT_ID);
  const secret = z.string().min(1).parse(env.PLAID_SECRET);
  const environment = z
    .enum([
      "sandbox",
      "production",
    ])
    .parse(env.PLAID_ENV ?? "sandbox");

  let requests = 0;
  return async function requestPlaid<T>(
    path: string,
    body: object,
    schema: z.ZodType<T>,
  ): Promise<T> {
    if (++requests > 40) {
      throw new PlaidError("REQUEST_BUDGET_EXCEEDED");
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    try {
      const response = await fetch(`https://${environment}.plaid.com${path}`, {
        method: "POST",
        redirect: "manual",
        headers: {
          "content-type": "application/json",
          "PLAID-CLIENT-ID": clientId,
          "PLAID-SECRET": secret,
          "Plaid-Version": "2020-09-14",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const error = ErrorSchema.safeParse(payload);
        throw new PlaidError(error.success ? error.data.error_code : "HTTP_ERROR");
      }
      return schema.parse(payload);
    } finally {
      clearTimeout(timer);
    }
  };
}
export type PlaidClient = ReturnType<typeof createPlaidClient>;
