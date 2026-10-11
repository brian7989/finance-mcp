import { CountryCode, type LinkTokenCreateRequest, Products } from "plaid";
import * as z from "zod";
import type { Env } from "../../../config/env.js";
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
  const products =
    kind === "bank"
      ? [
          Products.Transactions,
        ]
      : [
          Products.Investments,
        ];
  const body: LinkTokenCreateRequest = {
    client_name: "Personal Finance MCP",
    language: "en",
    country_codes: [
      CountryCode.Us,
      CountryCode.Ca,
    ],
    user: {
      client_user_id: z.string().min(1).parse(env.OWNER_EMAIL),
    },
    webhook: `${env.PUBLIC_ORIGIN}/webhooks/plaid`,
    hosted_link: {
      completion_redirect_uri: `${env.PUBLIC_ORIGIN}/connections/plaid/complete?flow=${flowId}`,
      url_lifetime_seconds: 1800,
    },
    ...(token
      ? {
          access_token: token,
        }
      : {
          products,
          optional_products:
            kind === "bank"
              ? [
                  Products.Investments,
                ]
              : [
                  Products.Transactions,
                ],
        }),
    transactions: {
      days_requested: 730,
    },
  };
  const link = await readPlaidResponse(LinkSchema, client.linkTokenCreate(body));
  const url = new URL(link.hosted_link_url);
  if (url.protocol !== "https:" || url.hostname !== "secure.plaid.com") {
    throw new Error("Unexpected Hosted Link origin");
  }
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
  let institution = "Financial institution";
  if (data.item.institution_id) {
    const response = await readPlaidResponse(
      InstitutionResponseSchema,
      client.institutionsGetById({
        institution_id: data.item.institution_id,
        country_codes: [
          CountryCode.Us,
          CountryCode.Ca,
        ],
      }),
    );
    institution = response.institution.name;
  }
  return {
    institution,
    capabilities: itemCapabilities(data.item.consented_products ?? data.item.billed_products),
  };
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
