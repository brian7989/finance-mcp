import axios, { type AxiosInstance, isAxiosError } from "axios";
import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import * as z from "zod";
import { AuthenticationError } from "../../../common/errors.js";
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
  const transport = createTransport();
  enforceRequestBudget(transport);
  return new PlaidApi(apiConfiguration(env), undefined, transport);
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
      throw providerFailure(parsed.success ? parsed.data.error_code : "HTTP_ERROR");
    }
    throw error;
  }
}
export type PlaidClient = PlaidApi;

function createTransport(): AxiosInstance {
  return axios.create({
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
}
function enforceRequestBudget(transport: AxiosInstance): void {
  let requests = 0;
  transport.interceptors.request.use((request) => {
    if (++requests > 40) {
      throw new PlaidError("REQUEST_BUDGET_EXCEEDED");
    }
    return request;
  });
}
function apiConfiguration(env: Env): Configuration {
  const environment = z
    .enum([
      "sandbox",
      "production",
    ])
    .parse(env.PLAID_ENV ?? "sandbox");
  return new Configuration({
    basePath: z.string().parse(PlaidEnvironments[environment]),
    baseOptions: {
      headers: apiCredentials(env),
    },
  });
}
function apiCredentials(env: Env): Record<string, string> {
  return {
    "PLAID-CLIENT-ID": z.string().min(1).parse(env.PLAID_CLIENT_ID),
    "PLAID-SECRET": z.string().min(1).parse(env.PLAID_SECRET),
  };
}
function providerFailure(code: string): Error {
  if (requiresSignIn(code)) {
    return new AuthenticationError("Plaid request failed", code);
  }
  return new PlaidError(code);
}
function requiresSignIn(code: string): boolean {
  return [
    "ITEM_LOGIN_REQUIRED",
    "INVALID_ACCESS_TOKEN",
    "ITEM_NOT_FOUND",
  ].includes(code);
}
