import { CountryCode, type LinkTokenCreateRequest, Products } from "plaid";
import * as z from "zod";
import { type Env, normalizeEmail } from "../../../config/env.js";
import type { Capability } from "../../finance/schemas.js";
import type { PlaidClient } from "./client.js";
import { readPlaidResponse } from "./client.js";
import { InstitutionResponseSchema, ItemResponseSchema } from "./schemas.js";

const LinkSchema = z.object({
  link_token: z.string(),
  hosted_link_url: z.url(),
  expiration: z.iso.datetime(),
});
const ExchangeSchema = z.object({
  access_token: z.string(),
  item_id: z.string(),
});
const SessionSchema = z.object({
  link_sessions: z.array(
    z.object({
      results: z
        .object({
          item_add_results: z
            .array(
              z.object({
                public_token: z.string(),
              }),
            )
            .optional(),
        })
        .nullish(),
    }),
  ),
});

export async function createHostedLink(
  client: PlaidClient,
  env: Env,
  flowId: string,
  kind: "bank" | "investment",
  token?: string,
) {
  const body = hostedLinkRequest(env, flowId, kind, token);
  const link = await readPlaidResponse(LinkSchema, client.linkTokenCreate(body));
  assertHostedLinkOrigin(link.hosted_link_url);
  return link;
}
export async function exchangeHostedLink(client: PlaidClient, linkToken: string) {
  const session = await readPlaidResponse(
    SessionSchema,
    client.linkTokenGet({
      link_token: linkToken,
    }),
  );
  const tokens = session.link_sessions.flatMap((value) => value.results?.item_add_results ?? []);
  if (tokens.length !== 1 || !tokens[0]) {
    throw new Error("Link has not completed or contains multiple items");
  }
  const exchanged = await readPlaidResponse(
    ExchangeSchema,
    client.itemPublicTokenExchange({
      public_token: tokens[0].public_token,
    }),
  );
  return exchanged;
}
export async function readItemDetails(client: PlaidClient, token: string) {
  const data = await readPlaidResponse(
    ItemResponseSchema,
    client.itemGet({
      access_token: token,
    }),
  );
  const institution = await readInstitutionName(client, data.item.institution_id);
  return {
    institution,
    capabilities: itemCapabilities(enabledProducts(data.item)),
  };
}
async function readInstitutionName(client: PlaidClient, id: string | null): Promise<string> {
  if (!id) {
    return "Financial institution";
  }
  const response = await readPlaidResponse(
    InstitutionResponseSchema,
    client.institutionsGetById({
      institution_id: id,
      country_codes: [
        CountryCode.Us,
        CountryCode.Ca,
      ],
    }),
  );
  return response.institution.name;
}

function enabledProducts(item: z.infer<typeof ItemResponseSchema>["item"]): string[] {
  const initialized = item.products ?? item.billed_products;
  const consented = item.consented_products;
  return consented ? initialized.filter((product) => consented.includes(product)) : initialized;
}
function itemCapabilities(products: string[]): Capability[] {
  const capabilities: Capability[] = [
    "balances",
  ];
  if (products.includes("transactions")) {
    capabilities.push("transactions");
  }
  if (products.includes("investments")) {
    capabilities.push("holdings", "investment_activity");
  }
  return capabilities;
}

function hostedLinkRequest(
  env: Env,
  flowId: string,
  kind: "bank" | "investment",
  token?: string,
): LinkTokenCreateRequest {
  return {
    client_name: "Personal Finance MCP",
    language: "en",
    country_codes: [
      CountryCode.Us,
      CountryCode.Ca,
    ],
    user: {
      client_user_id: plaidUserId(env),
    },
    webhook: `${env.PUBLIC_ORIGIN}/webhooks/plaid`,
    hosted_link: hostedLinkSettings(env, flowId),
    ...linkAccess(kind, token),
    transactions: {
      days_requested: 730,
    },
  };
}
function plaidUserId(env: Env): string {
  const email = z.email().transform(normalizeEmail).parse(env.OWNER_EMAIL);
  return env.FINANCE_STORE.idFromName(email).toString();
}
function hostedLinkSettings(env: Env, flowId: string) {
  return {
    completion_redirect_uri: `${env.PUBLIC_ORIGIN}/connections/plaid/complete?flow=${flowId}`,
    url_lifetime_seconds: 1800,
  };
}
function linkAccess(kind: "bank" | "investment", token: string | undefined) {
  if (token) {
    return {
      access_token: token,
    };
  }
  return {
    products: requestedProducts(kind),
    optional_products: optionalProducts(kind),
  };
}
function requestedProducts(kind: "bank" | "investment"): Products[] {
  if (kind === "bank") {
    return [
      Products.Transactions,
    ];
  }
  return [
    Products.Investments,
  ];
}
function optionalProducts(kind: "bank" | "investment"): Products[] {
  if (kind === "bank") {
    return [
      Products.Investments,
    ];
  }
  return [
    Products.Transactions,
  ];
}
function assertHostedLinkOrigin(target: string): void {
  const url = new URL(target);
  if (url.protocol !== "https:" || url.hostname !== "secure.plaid.com") {
    throw new Error("Unexpected Hosted Link origin");
  }
}
