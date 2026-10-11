import axios, { isAxiosError } from "axios";
import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import * as z from "zod";
import type { Env } from "../../../config/env.js";

export class PlaidError extends Error {
  constructor(readonly code: string) {
    super("Plaid request failed");
  }
}
const ErrorSchema = z.object({
  error_code: z.string(),
});

export function createPlaidClient(env: Env): PlaidApi {
  const environment = z
    .enum([
      "sandbox",
      "production",
    ])
    .parse(env.PLAID_ENV ?? "sandbox");
  const transport = axios.create({
    adapter: "fetch",
    timeout: 25000,
    fetchOptions: {
      redirect: "manual",
      cache: "no-store",
    },
    env: {
      fetch: (input, init) => fetch(input, init),
    },
  });
  let requests = 0;
  transport.interceptors.request.use((request) => {
    if (++requests > 40) {
      throw new PlaidError("REQUEST_BUDGET_EXCEEDED");
    }
    return request;
  });
  const configuration = new Configuration({
    basePath: z.string().parse(PlaidEnvironments[environment]),
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": z.string().min(1).parse(env.PLAID_CLIENT_ID),
        "PLAID-SECRET": z.string().min(1).parse(env.PLAID_SECRET),
      },
    },
  });
  return new PlaidApi(configuration, undefined, transport);
}
export async function readPlaidResponse<T>(
  schema: z.ZodType<T>,
  request: Promise<{
    data: unknown;
  }>,
): Promise<T> {
  try {
    return schema.parse((await request).data);
  } catch (error) {
    if (isAxiosError(error)) {
      const parsed = ErrorSchema.safeParse(error.response?.data);
      throw new PlaidError(parsed.success ? parsed.data.error_code : "HTTP_ERROR");
    }
    throw error;
  }
}
export type PlaidClient = PlaidApi;
