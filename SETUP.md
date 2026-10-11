# Setup

## Local checks

Use Node.js 24 and pnpm 10.14:

```sh
pnpm install --frozen-lockfile
pnpm check
```

Tests use synthetic data in Cloudflare's local runtime and never require bank credentials. Formatting uses Biome; typed ESLint rejects deprecated APIs.

## Cloudflare configuration

Use Workers Free. The configuration uses only a Worker, two SQLite Durable Object classes, OAuth KV, and a daily Cron Trigger. Wrangler provisions the new OAuth KV namespace at deployment. Keep this project's storage separate from the previous Benepass Worker.

Set these values through Wrangler secrets or a gitignored `.dev.vars` file:

| Variable | Purpose |
| --- | --- |
| `PUBLIC_ORIGIN` | Exact HTTPS origin of the Worker |
| `OWNER_EMAIL` | The only email permitted to sign in |
| `ACCESS_ISSUER` | Owner-only Cloudflare Access OIDC issuer |
| `ACCESS_CLIENT_ID` | Access OIDC client ID |
| `ACCESS_CLIENT_SECRET` | Access OIDC client secret |
| `BROWSER_KEY` | Random 32-byte key encoded as 64 lowercase hex characters |
| `DATA_KEY` | Separate random 32-byte key for stored Plaid credentials |
| `BENEPASS_EMAIL` | Optional email for the Benepass login-code flow |
| `PLAID_CLIENT_ID` | Plaid API client ID |
| `PLAID_SECRET` | API secret for the selected Plaid environment |
| `PLAID_ENV` | `sandbox` initially; `production` only with approved Trial access |

Create an owner-only Access SaaS OIDC application with callback `${PUBLIC_ORIGIN}/callback`, `openid` and `email` scopes, and PKCE. Server routes fail closed until owner authentication is configured.

Do not commit secrets, copy existing sessions into the repo, or place account credentials in assistant messages. Keep the encryption keys stable: replacing `DATA_KEY` without migrating credentials makes them unreadable. Cloudflare encrypts persisted storage at rest; Plaid tokens are additionally encrypted by this application.

Deploy with `pnpm run deploy`, then visit `${PUBLIC_ORIGIN}/connections`. Connect banking and investment institutions separately when their login portals differ. Use Plaid update mode to reconnect existing Items instead of consuming another Trial slot. Review account preferences, particularly accounts used for another person's finances.

Point compatible remote MCP clients at `${PUBLIC_ORIGIN}/mcp`. The server uses Streamable HTTP and OAuth with client metadata documents. Client compatibility and live institution coverage must be checked during deployment.

## History and refreshes

The daily Cron Trigger runs at 09:17 UTC. Verified Plaid webhooks also schedule refreshes. One institution is processed per alarm invocation; refreshes for the same connection are coalesced.

Balance history starts with the first successful observation, keeping the latest observation for each UTC day. Banking history can backfill up to the amount authorized and returned by Plaid; investment activity is retrieved separately. No prior daily balance history is invented. Benepass currently provides HSA balances and holdings; its transaction history is not normalized without a verified account mapping.

Disconnecting stops synchronization and revokes Plaid access when the provider is reachable, while preserving history. If revocation fails, retry disconnecting. Free-tier quotas are finite; no paid plan upgrade is configured. Keep real credentials out of local tests and fixtures.
