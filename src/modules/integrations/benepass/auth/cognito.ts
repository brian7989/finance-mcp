import { randomBytes } from "node:crypto";
import {
  AuthFlowType,
  ChallengeNameType,
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
  SignUpCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import * as z from "zod";
import { AuthenticationError } from "../../../../common/errors.js";
import { USER_AGENT } from "../constants.js";
import { CLIENT_ID, COGNITO_IDP_URL, COGNITO_REGION } from "./cognito.constants.js";

export type LoginChallenge = {
  challenge_name: string;
  challenge_session: string;
};

export type CognitoAuth = {
  destroy?(): void;
  initiateCustomAuth(email: string, allowEmailRegistration?: boolean): Promise<LoginChallenge>;
  respondToAuthChallenge(email: string, otp: string, challengeSession: string): Promise<string>;
};

const InitiateSchema = z.object({
  ChallengeName: z.string(),
  Session: z.string(),
  ChallengeParameters: z.record(z.string(), z.string()).optional(),
});

const RespondSchema = z.object({
  AuthenticationResult: z.object({
    RefreshToken: z.string().min(1),
  }),
});

export function createCognitoClient(): CognitoIdentityProviderClient {
  return new CognitoIdentityProviderClient({
    region: COGNITO_REGION,
    endpoint: COGNITO_IDP_URL,
    credentials: {
      accessKeyId: "anonymous",
      secretAccessKey: "anonymous",
    },
    customUserAgent: USER_AGENT,
  });
}

export function createCognitoAuth(
  client: CognitoIdentityProviderClient = createCognitoClient(),
): CognitoAuth {
  return {
    destroy: () => client.destroy(),
    initiateCustomAuth: (email, allowRegistration = false) =>
      startEmailLogin(client, email, allowRegistration),
    respondToAuthChallenge: (email, otp, session) =>
      completeEmailLogin(client, email, otp, session),
  };
}

async function startEmailLogin(
  client: CognitoIdentityProviderClient,
  inputEmail: string,
  allowRegistration: boolean,
): Promise<LoginChallenge> {
  const email = normalizeEmail(inputEmail);
  try {
    if (allowRegistration) {
      await registerEmailIdentity(client, email);
    }
    const challenge = await requestLoginChallenge(client, email);
    const emailChallenge = await selectEmailCodeProtocol(client, email, challenge);
    return toLoginChallenge(emailChallenge);
  } catch (error) {
    throw toLoginError(error, allowRegistration);
  }
}

async function completeEmailLogin(
  client: CognitoIdentityProviderClient,
  email: string,
  otp: string,
  session: string,
): Promise<string> {
  try {
    const response = await submitEmailCode(client, normalizeEmail(email), otp, session);
    return parseRefreshToken(response);
  } catch (error) {
    throw toCognitoError(error);
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function registerEmailIdentity(
  client: CognitoIdentityProviderClient,
  email: string,
): Promise<void> {
  // Provisioning is opt-in. Existing identities are never reset or replaced.
  try {
    await client.send(
      new SignUpCommand({
        ClientId: CLIENT_ID,
        Username: email,
        Password: createRandomPassword(),
        UserAttributes: [
          {
            Name: "email",
            Value: email,
          },
        ],
      }),
    );
  } catch (error) {
    if (!isCognitoErrorNamed(error, "UsernameExistsException")) {
      throw error;
    }
  }
}

type EmailChallenge = z.infer<typeof InitiateSchema>;

async function requestLoginChallenge(
  client: CognitoIdentityProviderClient,
  email: string,
): Promise<EmailChallenge> {
  const response = await client.send(
    new InitiateAuthCommand({
      AuthFlow: AuthFlowType.CUSTOM_AUTH,
      ClientId: CLIENT_ID,
      AuthParameters: {
        USERNAME: email,
      },
    }),
  );
  return parseEmailChallenge(response);
}

async function selectEmailCodeProtocol(
  client: CognitoIdentityProviderClient,
  email: string,
  challenge: EmailChallenge,
): Promise<EmailChallenge> {
  if (!isProtocolSelector(challenge)) {
    return challenge;
  }
  assertSupportedProtocol(challenge);
  const response = await client.send(
    new RespondToAuthChallengeCommand({
      ChallengeName: ChallengeNameType.CUSTOM_CHALLENGE,
      ClientId: CLIENT_ID,
      Session: challenge.Session,
      ChallengeResponses: {
        ...challenge.ChallengeParameters,
        USERNAME: email,
        ANSWER: "email_code_v0",
      },
      ClientMetadata: {
        protocol: "email_code_v0",
        schema_version: "1",
      },
    }),
  );
  return parseEmailChallenge(response);
}

function isProtocolSelector(challenge: EmailChallenge): boolean {
  return challenge.ChallengeParameters?.challenge_type === "protocol_selector";
}

function assertSupportedProtocol(challenge: EmailChallenge): void {
  if (challenge.ChallengeParameters?.schema_version !== "1") {
    throw new AuthenticationError("Unsupported Benepass login protocol");
  }
}

function parseEmailChallenge(response: unknown): EmailChallenge {
  const parsed = InitiateSchema.safeParse(response);
  if (!parsed.success || parsed.data.ChallengeName !== "CUSTOM_CHALLENGE") {
    throw new AuthenticationError("Cognito did not return an email login challenge");
  }
  return parsed.data;
}

function toLoginChallenge(challenge: EmailChallenge): LoginChallenge {
  return {
    challenge_name: challenge.ChallengeName,
    challenge_session: challenge.Session,
  };
}

function submitEmailCode(
  client: CognitoIdentityProviderClient,
  email: string,
  otp: string,
  session: string,
) {
  return client.send(
    new RespondToAuthChallengeCommand({
      ChallengeName: ChallengeNameType.CUSTOM_CHALLENGE,
      ClientId: CLIENT_ID,
      Session: session,
      ChallengeResponses: {
        USERNAME: email,
        ANSWER: otp,
      },
    }),
  );
}

function parseRefreshToken(response: unknown): string {
  const parsed = RespondSchema.safeParse(response);
  if (!parsed.success) {
    throw new AuthenticationError("Login failed: Cognito did not return a session");
  }
  return parsed.data.AuthenticationResult.RefreshToken;
}

function createRandomPassword(): string {
  // Base64 padding supplies a symbol; rejection sampling guarantees the other classes.
  let password: string;
  do {
    password = randomBytes(32).toString("base64");
  } while (!hasRequiredPasswordCharacters(password));
  return password;
}

function hasRequiredPasswordCharacters(password: string): boolean {
  return /[a-z]/.test(password) && /[A-Z]/.test(password) && /[0-9]/.test(password);
}

function isCognitoErrorNamed(error: unknown, name: string): boolean {
  return error instanceof Error && error.name === name;
}

function toLoginError(error: unknown, allowRegistration: boolean): AuthenticationError {
  if (!allowRegistration && isCognitoErrorNamed(error, "NotAuthorizedException")) {
    return new AuthenticationError("Email-code login was rejected.", "EMAIL_LOGIN_SETUP_REQUIRED");
  }
  return toCognitoError(error);
}

function toCognitoError(error: unknown): AuthenticationError {
  if (error instanceof AuthenticationError) {
    return error;
  }
  return new AuthenticationError("Cognito request failed");
}
