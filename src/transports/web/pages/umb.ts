import { html } from "hono/html";
import type { OwnerSession } from "../../../modules/auth/session.js";
import type { UmbMethod } from "../../../modules/integrations/umb/auth.js";
import { type HtmlTemplate, page } from "./layout.js";

export function umbMethodPage(owner: OwnerSession, methods: UmbMethod[]): HtmlTemplate {
  return page(
    "Verify UMB sign-in",
    html`
    <p class="eyebrow">Connect UMB HSA</p><h1>Verify your sign-in</h1>
    <p>Choose where UMB should send your verification code.</p>
    <form method="post" action="/connections/umb/code">
      <input type="hidden" name="csrf" value="${owner.csrf}">
      ${methods.map((option, index) => html`<label class="field"><input type="radio" name="method" value="${option.method}" ${index === 0 ? "checked" : ""} required> ${option.label}</label>`)}
      <button>Send code</button>
    </form>`,
  );
}
export function umbCodePage(owner: OwnerSession): HtmlTemplate {
  return page(
    "UMB verification code",
    html`
    <p class="eyebrow">Connect UMB HSA</p><h1>Enter your code</h1>
    <p>Use the six-digit verification code UMB just sent.</p>
    <form method="post" action="/connections/umb/complete">
      <input type="hidden" name="csrf" value="${owner.csrf}">
      <label class="field">Verification code <input name="otp" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required></label>
      <button>Connect UMB</button>
    </form>`,
  );
}
