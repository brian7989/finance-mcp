import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";
export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: {
        configPath: "./wrangler.jsonc",
      },
      miniflare: {
        bindings: {
          PUBLIC_ORIGIN: "https://mcp.example.com",
          OWNER_EMAIL: "owner@example.com",
          BENEPASS_EMAIL: "benefits@example.com",
          ACCESS_ISSUER: "https://identity.example.com",
          ACCESS_CLIENT_ID: "test-client",
          ACCESS_CLIENT_SECRET: "fixture-only-client-secret",
          BROWSER_KEY: "a".repeat(64),
          DATA_KEY: "b".repeat(64),
          PLAID_CLIENT_ID: "fixture-client",
          PLAID_SECRET: "fixture-secret",
          PLAID_ENV: "sandbox",
        },
      },
    }),
  ],
  test: {
    globals: true,
  },
});
