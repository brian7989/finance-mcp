import { DurableObject } from "cloudflare:workers";
import * as z from "zod";
import { ApiHttpError, AuthenticationError, NotLoggedInError } from "../../../../common/errors.js";
import { type Env, readConfiguration } from "../../../../config/env.js";
import type { ApiGetOptions } from "../client.js";
import { employeeHeaders, employeeUrl, fetchJson } from "../http.js";
import { type ReadResult, readFailure } from "../read-result.js";
import { createCognitoAuth } from "./cognito.js";
import { type AccessToken, refreshAccessToken } from "./tokens.js";

const SessionSchema = z.object({
  refreshToken: z.string().min(1),
  revision: z.uuid(),
});
type Session = z.infer<typeof SessionSchema>;
type PendingLogin = {
  flowId: string;
  revision: string;
  challenge: string;
  expiresAt: number;
};

export class BenepassSession extends DurableObject<Env> {
  private cached: AccessToken | undefined;
  private refreshing: Promise<AccessToken> | undefined;
  private generation = 0;

  async status(): Promise<{
    logged_in: boolean;
  }> {
    return {
      logged_in: (await this.loadSession()) !== undefined,
    };
  }
  async startLogin(flowId: string, allowRegistration: boolean): Promise<void> {
    const configuration = readConfiguration(this.env);
    await this.enforceLoginCooldown();
    const revision = await this.advanceRevision();
    const cognito = createCognitoAuth();
    try {
      const result = await cognito.initiateCustomAuth(
        z.email().parse(configuration.BENEPASS_EMAIL),
        allowRegistration,
      );
      await this.assertRevision(revision);
      await this.ctx.storage.put<PendingLogin>("login", {
        flowId,
        revision,
        challenge: result.challenge_session,
        expiresAt: Date.now() + 10 * 60_000,
      });
    } finally {
      cognito.destroy?.();
    }
  }
  async completeLogin(flowId: string, otp: string): Promise<void> {
    const login = await this.requirePendingLogin(flowId);
    await this.ctx.storage.delete("login");
    const cognito = createCognitoAuth();
    try {
      const refreshToken = await cognito.respondToAuthChallenge(
        z.email().parse(readConfiguration(this.env).BENEPASS_EMAIL),
        otp,
        login.challenge,
      );
      await this.assertRevision(login.revision);
      this.clearCachedToken();
      await this.ctx.storage.put<Session>("session", {
        refreshToken,
        revision: login.revision,
      });
    } finally {
      cognito.destroy?.();
    }
  }
  async logout(): Promise<{
    ok: true;
  }> {
    this.clearCachedToken();
    await this.advanceRevision();
    await this.ctx.storage.delete([
      "session",
      "login",
    ]);
    return {
      ok: true,
    };
  }
  async read(path: string, options: ApiGetOptions): Promise<ReadResult> {
    try {
      return {
        ok: true,
        data: await this.readResource(path, options),
      };
    } catch (error) {
      return readFailure(error);
    }
  }

  private async readResource(path: string, options: ApiGetOptions): Promise<unknown> {
    const session = await this.requireSession();
    const url = employeeUrl(path, options.query);
    try {
      return await this.readWithToken(url, options.workspaceId, session);
    } catch (error) {
      if (!(error instanceof ApiHttpError) || error.status !== 401) {
        throw error;
      }
      this.cached = undefined;
      return this.readWithToken(url, options.workspaceId, session);
    }
  }
  private async readWithToken(
    url: URL,
    workspaceId: string | undefined,
    session: Session,
  ): Promise<unknown> {
    const token = await this.getAccessToken(session);
    await this.assertSessionCurrent(session);
    const payload = await fetchJson(url, {
      headers: employeeHeaders(token.value, workspaceId),
    });
    await this.assertSessionCurrent(session);
    return payload;
  }
  private async getAccessToken(session: Session): Promise<AccessToken> {
    if (this.cached && this.cached.expiresAt > Date.now()) {
      return this.cached;
    }
    if (this.refreshing) {
      return this.refreshing;
    }
    const generation = this.generation;
    const pending = refreshAccessToken(session.refreshToken);
    this.refreshing = pending;
    try {
      const token = await pending;
      await this.assertSessionCurrent(session);
      if (generation === this.generation) {
        this.cached = token;
      }
      return token;
    } catch (error) {
      if (error instanceof AuthenticationError) {
        await this.removeExpiredSession(session);
      }
      throw error;
    } finally {
      if (this.refreshing === pending) {
        this.refreshing = undefined;
      }
    }
  }
  private async removeExpiredSession(expected: Session): Promise<void> {
    const removed = await this.ctx.storage.transaction(async (storage) => {
      const current = await storage.get<Session>("session");
      if (current?.revision !== expected.revision) {
        return false;
      }
      await storage.delete("session");
      return true;
    });
    if (removed) {
      this.clearCachedToken();
    }
  }
  private clearCachedToken(): void {
    ++this.generation;
    this.cached = undefined;
    this.refreshing = undefined;
  }
  private async loadSession(): Promise<Session | undefined> {
    const session = await this.ctx.storage.get("session");
    return session === undefined ? undefined : SessionSchema.parse(session);
  }
  private async requireSession(): Promise<Session> {
    const session = await this.loadSession();
    if (!session) {
      throw new NotLoggedInError();
    }
    return session;
  }
  private async assertSessionCurrent(expected: Session): Promise<void> {
    const current = await this.requireSession();
    await this.assertRevision(expected.revision);
    if (current.revision !== expected.revision) {
      throw new AuthenticationError("Session changed during request");
    }
  }
  private async advanceRevision(): Promise<string> {
    const revision = crypto.randomUUID();
    await this.ctx.storage.put("revision", revision);
    return revision;
  }
  private async assertRevision(expected: string): Promise<void> {
    if ((await this.ctx.storage.get("revision")) !== expected) {
      throw new AuthenticationError("Login was superseded. Reconnect the connector.");
    }
  }
  private async requirePendingLogin(flowId: string): Promise<PendingLogin> {
    const login = await this.ctx.storage.get<PendingLogin>("login");
    if (!login || login.flowId !== flowId || login.expiresAt <= Date.now()) {
      throw new AuthenticationError("Login expired. Reconnect the connector.");
    }
    await this.assertRevision(login.revision);
    return login;
  }
  private async enforceLoginCooldown(): Promise<void> {
    const nextAllowed = await this.ctx.storage.get<number>("next_login_at");
    if (nextAllowed && nextAllowed > Date.now()) {
      throw new AuthenticationError("Wait a minute before requesting another code.");
    }
    await this.ctx.storage.put("next_login_at", Date.now() + 60_000);
  }
}
