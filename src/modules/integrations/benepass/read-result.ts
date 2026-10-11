import {
  ApiHttpError,
  AuthenticationError,
  NotLoggedInError,
  SchemaError,
} from "../../../common/errors.js";

export type ReadResult =
  | {
      ok: true;
      data: unknown;
    }
  | {
      ok: false;
      kind: "not_linked" | "authentication" | "schema" | "unavailable";
    }
  | {
      ok: false;
      kind: "http";
      status: number;
    };

export function readFailure(error: unknown): ReadResult {
  if (error instanceof NotLoggedInError) {
    return {
      ok: false,
      kind: "not_linked",
    };
  }
  if (error instanceof AuthenticationError) {
    return {
      ok: false,
      kind: "authentication",
    };
  }
  if (error instanceof ApiHttpError) {
    return {
      ok: false,
      kind: "http",
      status: error.status,
    };
  }
  if (error instanceof SchemaError) {
    return {
      ok: false,
      kind: "schema",
    };
  }
  return {
    ok: false,
    kind: "unavailable",
  };
}
export function unwrapRead(result: ReadResult): unknown {
  if (result.ok) {
    return result.data;
  }
  if (result.kind === "not_linked") {
    throw new NotLoggedInError();
  }
  if (result.kind === "authentication") {
    throw new AuthenticationError("Reconnect Benepass");
  }
  if (result.kind === "http") {
    throw new ApiHttpError(result.status, "employee API");
  }
  if (result.kind === "schema") {
    throw new SchemaError("Unexpected Benepass response");
  }
  throw new Error("Benepass is unavailable");
}
