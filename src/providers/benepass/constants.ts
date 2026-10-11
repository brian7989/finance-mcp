export const API_BASE_URL = "https://api.benefitsapi.com";
export const USER_AGENT = "benepass-mcp (https://github.com/brian7989/benepass-mcp-cloudflare)";

export const PATHS = {
  me: "/v2/me/",
  workspaces: "/v2/me/workspaces/",
  accounts: "/v2/me/accounts/",
  transactions: "/v2/me/transactions/",
  hsaAccountDetails: "/v2/me/hsa-account-details/",
  documents: "/v2/me/documents/",
} as const;

// Endpoints observed in Benepass's employee frontend, not candidate fallbacks.
export function pathId(value: string): string {
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(value)) {
    throw new Error("Invalid resource identifier");
  }
  return value;
}

export function hsaPath(accountId: string, resource: "balance" | "positions"): string {
  return `${PATHS.accounts}${pathId(accountId)}/hsa-investments/portfolio/${resource}/`;
}

export function documentPath(documentId: string): string {
  return `${PATHS.documents}${pathId(documentId)}/`;
}
