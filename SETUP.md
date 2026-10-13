# Setup

## Local checks

Use Node.js 24 and pnpm 10.14:

```sh
pnpm install --frozen-lockfile
pnpm check
```

Tests use synthetic data in Cloudflare's local runtime and never require bank credentials. Formatting uses Biome; typed ESLint rejects deprecated APIs.

Hono declares HTTP routes and composes named middleware. React renders the connections interface with shadcn/ui components and Tailwind. Vite builds browser assets served by the same Worker. Owner-only HTML supplies a minimal, escaped data snapshot; native forms use the existing authenticated routes. Owner-session and CSRF checks remain explicit, while signed webhooks retain their original bytes. Run `pnpm dev` for local Workers development; it builds browser assets first. After changing the frontend, restart it or run `pnpm build:client`. The deploy and check commands also build assets.

The official Plaid SDK handles API requests through Axios’s Workers-compatible fetch adapter. openid-client handles upstream OIDC, big.js handles decimal arithmetic, and Drizzle manages typed SQLite queries and versioned migrations. A typed registry selects provider factories. Adapters own credential resolution, provider errors, and disconnection behavior; connection workflows, refresh scheduling, and storage repositories stay separate.

After changing `src/database/schema.ts`, run `pnpm db:generate`, review the generated SQL, and register its import in `src/database/migrations.ts`. Commit the migration and Drizzle metadata together. Migrations run when the Durable Object starts; the initial migration also adopts the previous schema without deleting history.

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

Daily refreshes start at midnight Pacific (America/Los_Angeles). Cloudflare triggers at 07:00 and 08:00 UTC; the Worker runs only the trigger that falls at local midnight, accounting for daylight saving time. Verified Plaid webhooks also schedule refreshes. One institution is processed per alarm invocation; refreshes for the same connection are coalesced.

Balance history starts with the first successful observation, keeping the latest observation for each UTC day. Banking history can backfill up to the amount authorized and returned by Plaid; investment activity initially backfills up to two years. Later refreshes reread a 90-day overlap and extend it to cover time since the previous successful refresh, bounded by two years. Corrections older than that refresh window require a separate backfill. No prior daily balance history is invented. Benepass currently provides HSA balances and holdings; its transaction history is not normalized without a verified account mapping.

Internal account IDs preserve preferences and history through ordinary refreshes and runtime restarts. A newly created Plaid Item is a separate connection; accounts are not guessed to match by name or mask.

Disconnecting stops synchronization and revokes Plaid access when the provider is reachable, while preserving history. If revocation fails, retry disconnecting. Free-tier quotas are finite; no paid plan upgrade is configured. Keep real credentials out of local tests and fixtures.

## UMB HSA

Connect UMB under **Other institutions** in the workspace. No additional secrets or Cloudflare resources are needed. Your password is used for sign-in only; the connector stores the resulting session encrypted. Complete email or SMS verification when requested. If UMB expires the session, sign in again from the connect dialog.

UMB cash and investment balances are separated without counting the combined total twice. Cash transactions backfill the years available through the portal, within a bounded refresh budget. Holdings and investment activity are not currently supported.
