import { decodeHTML } from "entities";
import * as z from "zod";
import { AuthenticationError } from "../../../common/errors.js";
import { boundedText, UmbClient } from "./client.js";
import { UmbAccountsSchema } from "./schemas.js";

export const UmbLoginInputSchema = z.object({
  username: z.string().min(1).max(200),
  password: z.string().min(1).max(500),
});
export const UmbLoginStateSchema = z.object({
  kind: z.literal("umb"),
  cookies: z.string(),
  ticket: z.string().optional(),
  method: z
    .enum([
      "email",
      "sms",
      "phone",
    ])
    .optional(),
});
export type UmbLoginState = z.infer<typeof UmbLoginStateSchema>;
export type UmbMethod = {
  method: "email" | "sms" | "phone";
  label: string;
};
const UserInfoSchema = z.object({
  Email: z.string().nullish(),
  MobileNum: z.string().nullish(),
  Phone: z.string().nullish(),
});
const methodNumbers = {
  email: "1",
  sms: "0",
  phone: "2",
};

export async function beginUmbLogin(input: unknown) {
  const credentials = UmbLoginInputSchema.parse(input);
  const client = new UmbClient();
  const login = await client.authenticate("/Authentication/Handshake");
  const csrf = await readLoginCsrf(await boundedText(login));
  const response = await client.authenticate(
    "/Authentication/Handshake",
    new URLSearchParams({
      UserName: credentials.username,
      Password: credentials.password,
      __RequestVerificationToken: csrf,
    }),
  );
  const html = await boundedText(response);
  const ticket = readMfaTicket(html);
  const state: UmbLoginState = {
    kind: "umb",
    cookies: client.serialize(),
  };
  if (!ticket) {
    await client.read("/Accounts/List", UmbAccountsSchema);
    return {
      state: {
        ...state,
        cookies: client.serialize(),
      },
      methods: [],
    };
  }
  state.ticket = ticket;
  const methods = await readMethods(client, ticket, html.includes("isSmsOnly: true"));
  return {
    state: {
      ...state,
      cookies: client.serialize(),
    },
    methods,
  };
}
export async function sendUmbCode(state: UmbLoginState, method: UmbMethod["method"]) {
  const client = new UmbClient(state.cookies);
  const response = await client.authenticate(
    "/Authentication/GenerateCode",
    mfaForm(state, method),
  );
  await response.body?.cancel();
  return {
    ...state,
    method,
    cookies: client.serialize(),
  };
}
export async function completeUmbCode(state: UmbLoginState, code: string): Promise<string> {
  if (!state.method || !state.ticket) {
    throw new Error("UMB verification has not started");
  }
  const token = z
    .string()
    .regex(/^\d{6}$/)
    .parse(code);
  const client = new UmbClient(state.cookies);
  const form = mfaForm(state, state.method);
  form.set("token", token);
  const validation = await client.authenticate("/Authentication/SubmitCode", form);
  await validation.body?.cancel();
  const completed = await client.authenticate(
    "/Authentication/VerifyCode",
    new URLSearchParams({
      ticket: state.ticket,
      token,
      returnUrl: "",
    }),
  );
  await completed.body?.cancel();
  await client.read("/Accounts/List", UmbAccountsSchema);
  return client.serialize();
}
async function readLoginCsrf(html: string): Promise<string> {
  let token: string | null = null;
  await new HTMLRewriter()
    .on('input[name="__RequestVerificationToken"]', {
      element(element) {
        token = element.getAttribute("value");
      },
    })
    .transform(new Response(html))
    .arrayBuffer();
  if (!token) {
    throw new AuthenticationError("UMB login unavailable", "UMB_LOGIN_FAILED");
  }
  return token;
}
function readMfaTicket(html: string): string | undefined {
  const match = /\bticket:\s*"([^"\r\n]+)"/.exec(html);
  return match?.[1] ? decodeHTML(match[1]) : undefined;
}
async function readMethods(
  client: UmbClient,
  ticket: string,
  smsOnly: boolean,
): Promise<UmbMethod[]> {
  const response = await client.authenticate(
    "/Authentication/GetUserInfo",
    new URLSearchParams({
      ticket,
    }),
  );
  const info = UserInfoSchema.parse(JSON.parse(await boundedText(response)));
  const methods: UmbMethod[] = [];
  if (info.Email && !smsOnly) {
    methods.push({
      method: "email",
      label: maskEmail(info.Email),
    });
  }
  if (info.MobileNum) {
    methods.push({
      method: "sms",
      label: `Mobile ending ${info.MobileNum.replace(/\D/g, "").slice(-4)}`,
    });
  }
  if (info.Phone) {
    methods.push({
      method: "phone",
      label: `Phone ending ${info.Phone.replace(/\D/g, "").slice(-4)}`,
    });
  }
  if (!methods.length) {
    throw new AuthenticationError("No supported UMB verification method", "UMB_MFA_UNAVAILABLE");
  }
  return methods;
}
function mfaForm(state: UmbLoginState, method: UmbMethod["method"]): URLSearchParams {
  if (!state.ticket) {
    throw new Error("UMB verification expired");
  }
  return new URLSearchParams({
    ticket: state.ticket,
    type: methodNumbers[method],
  });
}
function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  return `${name?.slice(0, 1) ?? ""}•••@${domain ?? ""}`;
}
