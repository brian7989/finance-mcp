import type { Configuration } from "../../config/env.js";

export function assertSameOrigin(request: Request, configuration: Configuration): void {
  if (request.headers.get("origin") !== configuration.PUBLIC_ORIGIN) {
    throw new Error("Invalid form origin");
  }
}
