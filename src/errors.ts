export class AuthenticationError extends Error {
  readonly code: string;

  constructor(message: string, code = "AUTH") {
    super(message);
    this.name = "AuthenticationError";
    this.code = code;
  }
}

export class NotLoggedInError extends AuthenticationError {
  constructor(message = "Benepass is not linked. Reconnect the connector.") {
    super(message, "NOT_LOGGED_IN");
    this.name = "NotLoggedInError";
  }
}

export class ApiHttpError extends Error {
  readonly status: number;
  readonly path: string;

  constructor(status: number, path: string) {
    super(`Benepass API GET ${path} failed (HTTP ${String(status)})`);
    this.name = "ApiHttpError";
    this.status = status;
    this.path = path;
  }
}

export class SchemaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SchemaError";
  }
}

export function errorCode(err: unknown): string | undefined {
  if (err instanceof Error && "code" in err && typeof err.code === "string") {
    return err.code;
  }
  return undefined;
}
