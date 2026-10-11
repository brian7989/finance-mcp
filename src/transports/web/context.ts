import type { Context } from "hono";
import { createFactory } from "hono/factory";
import type { Configuration, Env } from "../../config/env.js";
import type { OwnerSession } from "../../modules/auth/session.js";

export type WebEnvironment = {
  Bindings: Env;
  Variables: {
    configuration: Configuration;
    owner: OwnerSession;
    form: URLSearchParams;
  };
};
export type WebContext = Context<WebEnvironment>;
export const webFactory = createFactory<WebEnvironment>();
