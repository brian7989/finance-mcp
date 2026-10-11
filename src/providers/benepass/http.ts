import { ApiHttpError, SchemaError } from "../../errors.js";
import { API_BASE_URL, USER_AGENT } from "./constants.js";

export async function fetchJson(url: string | URL, init: RequestInit = {}): Promise<unknown> {
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), 30_000);
  try {
    return await requestJson(url, init, controller.signal);
  } finally {
    clearTimeout(deadline);
  }
}
async function requestJson(
  url: string | URL,
  init: RequestInit,
  signal: AbortSignal,
): Promise<unknown> {
  const response = await fetch(url, {
    ...init,
    redirect: "manual",
    signal,
  });
  await assertSuccessfulResponse(response);
  return readJsonBody(response);
}
export function employeeUrl(
  path: string,
  query: Record<string, string | number | undefined> = {},
): URL {
  const url = new URL(path, API_BASE_URL);
  assertEmployeeUrl(url);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }
  return url;
}
export function employeeHeaders(accessToken: string, workspaceId?: string): Headers {
  const headers = new Headers({
    authorization: `Bearer ${accessToken}`,
    accept: "application/json",
    "user-agent": USER_AGENT,
    "x-benepass-client": "employee-web",
    "x-benepass-platform": "web",
  });
  if (workspaceId) {
    headers.set("x-benepass-workspace-id", workspaceId);
  }
  return headers;
}
function assertEmployeeUrl(url: URL): void {
  if (
    url.origin !== API_BASE_URL ||
    !url.pathname.startsWith("/v2/me/") ||
    url.username ||
    url.password ||
    url.hash
  ) {
    throw new SchemaError("Invalid Benepass API path");
  }
}
async function assertSuccessfulResponse(response: Response): Promise<void> {
  if (!response.ok) {
    await response.body?.cancel();
    throw new ApiHttpError(response.status, "employee API");
  }
}
async function readJsonBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new SchemaError("Unexpected non-JSON payload from Benepass");
  }
}
