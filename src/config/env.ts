import type { OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import * as z from "zod";
import type { FinanceStore } from "../database/finance-store.js";
import type { BenepassSession } from "../modules/integrations/benepass/auth/session.js";

export interface Env {
  ASSETS: Fetcher;
  OAUTH_KV: KVNamespace;
  OAUTH_PROVIDER: OAuthHelpers;
  BENEPASS_SESSION: DurableObjectNamespace<BenepassSession>;
  FINANCE_STORE: DurableObjectNamespace<FinanceStore>;
  PUBLIC_ORIGIN?: string;
  OWNER_EMAIL?: string;
  BENEPASS_EMAIL?: string;
  ACCESS_ISSUER?: string;
  ACCESS_CLIENT_ID?: string;
  ACCESS_CLIENT_SECRET?: string;
  BROWSER_KEY?: string;
  DATA_KEY?: string;
  PLAID_CLIENT_ID?: string;
  PLAID_SECRET?: string;
  PLAID_ENV?: "sandbox" | "production";
}

const ConfigurationSchema = z.object({
  PUBLIC_ORIGIN: z.url().refine(isHttpsOrigin),
  OWNER_EMAIL: z.email().transform(normalizeEmail),
  BENEPASS_EMAIL: z.email().transform(normalizeEmail).optional(),
  ACCESS_ISSUER: z.url().refine(isHttpsUrl),
  ACCESS_CLIENT_ID: z.string().min(1),
  ACCESS_CLIENT_SECRET: z.string().min(1),
  BROWSER_KEY: z.string().regex(/^[a-f0-9]{64}$/),
});
export type Configuration = z.infer<typeof ConfigurationSchema>;

export function readConfiguration(env: Env): Configuration {
  return ConfigurationSchema.parse(env);
}
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
export function ownerStore(env: Env) {
  const email = z.email().transform(normalizeEmail).parse(env.OWNER_EMAIL);
  return env.FINANCE_STORE.getByName(email);
}
export function ownerSession(env: Env) {
  const email = z.email().transform(normalizeEmail).parse(env.OWNER_EMAIL);
  return env.BENEPASS_SESSION.getByName(email);
}
function isHttpsUrl(value: string): boolean {
  const url = new URL(value);
  return url.protocol === "https:" && !url.username && !url.password && !url.hash && !url.search;
}
function isHttpsOrigin(value: string): boolean {
  return isHttpsUrl(value) && new URL(value).origin === value;
}

declare global {
  namespace Cloudflare {
    interface Env extends ApplicationEnvironment {}
    interface GlobalProps {
      mainModule: typeof import("../worker.js");
    }
  }
}
type ApplicationEnvironment = Env;
