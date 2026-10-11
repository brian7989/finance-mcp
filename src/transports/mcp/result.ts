import type { CallToolResult } from "@modelcontextprotocol/server";
import * as z from "zod";
import {
  ApiHttpError,
  AuthenticationError,
  NotLoggedInError,
  SchemaError,
} from "../../common/errors.js";

export async function runTool(
  fn: () => Promise<unknown>,
  schema?: z.ZodType,
): Promise<CallToolResult> {
  try {
    const data = await fn();
    return ok(schema ? schema.parse(data) : data);
  } catch (error) {
    return mapError(error);
  }
}

export function ok(data: unknown): CallToolResult {
  const structured = asStructuredContent(data);
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(structured, null, 2),
      },
    ],
    structuredContent: structured,
  };
}

export function mapError(error: unknown): CallToolResult {
  logToolFailure(error);
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: getSafeErrorMessage(error),
      },
    ],
  };
}

function getSafeErrorMessage(error: unknown): string {
  // Never echo upstream bodies, exception messages, headers, URLs, or tokens.
  if (error instanceof NotLoggedInError) {
    return "Benepass is not linked. Reconnect this connector to sign in through the browser.";
  }
  if (error instanceof AuthenticationError) {
    return getAuthenticationMessage(error);
  }
  if (error instanceof ApiHttpError) {
    return `Benepass API returned HTTP ${error.status}.`;
  }
  if (error instanceof SchemaError) {
    return error.message;
  }
  return "Unable to complete the request.";
}

function getAuthenticationMessage(_error: AuthenticationError): string {
  return "Benepass authentication failed. Reconnect this connector to sign in through the browser.";
}

function logToolFailure(error: unknown): void {
  console.error(`benepass-mcp: tool failure (${getDiagnosticCategory(error)})`);
}

function getDiagnosticCategory(error: unknown): string {
  // Fixed categories only: Error messages and Zod issues may contain credentials.
  if (error instanceof NotLoggedInError) {
    return "not_logged_in";
  }
  if (error instanceof AuthenticationError) {
    return "authentication";
  }
  if (error instanceof ApiHttpError) {
    return `api_http_${error.status}`;
  }
  if (error instanceof SchemaError || error instanceof z.ZodError) {
    return "invalid_payload";
  }
  return "unexpected";
}

function asStructuredContent(data: unknown): Record<string, unknown> {
  if (typeof data === "object" && data !== null && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  return {
    data,
  };
}
