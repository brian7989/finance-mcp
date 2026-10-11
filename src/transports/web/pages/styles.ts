export const styles = `
:root {
  color-scheme: light;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: #172b2a;
  background: #f5f6f3;
  font-synthesis: none;
  -webkit-font-smoothing: antialiased;
  --muted: #657470;
  --line: #e2e7e1;
  --accent: #224f42;
}
* {
  box-sizing: border-box;
}
body {
  margin: 0;
}
a {
  color: var(--accent);
  text-underline-offset: 4px;
}
button,
input,
select {
  font: inherit;
}
button,
.button,
summary {
  -webkit-tap-highlight-color: transparent;
}
button,
.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 11px 18px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: var(--accent);
  color: white;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  transition:
    background 0.15s,
    border-color 0.15s;
}
button:hover,
.button:hover {
  background: #173d32;
}
button:active,
.button:active {
  background: #102e25;
}
button.secondary {
  background: white;
  color: #263f37;
  border-color: #dce3dc;
}
button.secondary:hover {
  background: #f4f7f2;
  border-color: #aab9ae;
}
button.quiet {
  background: transparent;
  color: var(--muted);
  padding: 8px 0;
}
button.quiet:hover {
  color: #172b2a;
}
button.danger {
  background: transparent;
  color: #a5483c;
  border-color: #ead9d4;
}
button.danger:hover {
  background: #fff5f1;
}
:focus-visible {
  outline: 3px solid #78a590;
  outline-offset: 4px;
}
.shell {
  width: min(1080px, calc(100% - 64px));
  margin: 0 auto;
}
.brand-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 30px 0;
  border-bottom: 1px solid var(--line);
}
.brand {
  display: flex;
  align-items: center;
  gap: 12px;
}
.brand-mark {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  background: #203e34;
  color: #f4f8ee;
  border-radius: 11px;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: -1px;
}
.brand-name {
  display: block;
  font-size: 15px;
  font-weight: 650;
  letter-spacing: -0.3px;
}
.brand-caption {
  display: block;
  margin-top: 4px;
  color: var(--muted);
  font-size: 10px;
  letter-spacing: 1.5px;
  text-transform: uppercase;
}
.privacy {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--muted);
  font-size: 12px;
}
.privacy::before {
  content: "";
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #608b6f;
}
main {
  padding: 54px 0 32px;
}
h1,
h2,
h3,
p {
  margin: 0;
}
h1 {
  font-size: clamp(28px, 4vw, 38px);
  font-weight: 600;
  letter-spacing: -1.5px;
  line-height: 1.15;
}
h2 {
  font-size: 19px;
  font-weight: 600;
  letter-spacing: -0.5px;
}
h3 {
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.4px;
}
p {
  line-height: 1.65;
  color: var(--muted);
}
.page-heading {
  margin-bottom: 30px;
}
.eyebrow {
  color: #7b897f;
  text-transform: uppercase;
  font-size: 11px;
  letter-spacing: 1.7px;
  font-weight: 600;
  margin-bottom: 12px;
}
.intro {
  margin-top: 14px;
  max-width: 610px;
  font-size: 15px;
}
.overview {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 9px;
  margin-top: 22px;
  color: var(--muted);
  font-size: 13px;
}
.overview strong {
  color: #203e34;
  font-weight: 600;
}
.overview .separator {
  color: #bdc7bc;
}
.add-panel {
  background: #eaf0e7;
  border: 1px solid #dbe4d7;
  border-radius: 15px;
  margin-bottom: 38px;
}
.add-panel > summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 24px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  list-style: none;
}
summary::-webkit-details-marker {
  display: none;
}
.add-panel > summary::after {
  content: "+";
  font-size: 22px;
  line-height: 1;
  font-weight: 400;
}
.add-panel[open] > summary::after {
  content: "−";
}
.add-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 30px;
  padding: 0 24px 24px;
}
.add-option {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.add-option + .add-option {
  border-left: 1px solid #d3ddce;
  padding-left: 30px;
}
.add-option p {
  font-size: 13px;
}
.add-option h3 {
  font-size: 15px;
  margin-bottom: 5px;
}
.add-option button {
  align-self: flex-start;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
  color: #40564d;
}
input:not([type="checkbox"]):not([type="hidden"]),
select {
  width: 100%;
  min-height: 44px;
  border: 1px solid #d6ded3;
  border-radius: 9px;
  padding: 10px 12px;
  background: white;
  color: #243a31;
  font-size: 14px;
}
.check {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  color: #52665b;
  font-size: 13px;
  line-height: 1.5;
  font-weight: 400;
}
.check input {
  width: 16px;
  height: 16px;
  margin: 2px 0 0;
  flex-shrink: 0;
  accent-color: var(--accent);
}
.section-heading {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 17px;
}
.count {
  display: grid;
  place-items: center;
  min-width: 23px;
  height: 23px;
  border: 1px solid var(--line);
  border-radius: 7px;
  font-size: 11px;
  color: var(--muted);
  font-weight: 500;
}
.connection-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}
.connection-card {
  background: white;
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 24px;
}
.connection-heading {
  display: flex;
  align-items: flex-start;
  gap: 13px;
}
.institution-mark {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: #f0f3ee;
  color: #305140;
  font-size: 17px;
  font-weight: 600;
}
.institution-name {
  flex: 1;
  min-width: 0;
}
.institution-name h3 {
  overflow-wrap: anywhere;
  margin: 2px 0 6px;
}
.institution-name p {
  font-size: 12px;
}
.status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
  border-radius: 20px;
  padding: 6px 9px;
  background: #edf5ed;
  color: #426847;
  font-size: 10px;
  font-weight: 600;
}
.status::before {
  content: "";
  width: 5px;
  height: 5px;
  background: currentColor;
  border-radius: 50%;
}
.status.warning {
  background: #fff3df;
  color: #916119;
}
.status.inactive {
  background: #f0f1ef;
  color: #777d77;
}
.capabilities {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin: 24px 0 20px;
}
.capability {
  border: 1px solid #e6ebe3;
  border-radius: 6px;
  color: #61715f;
  padding: 5px 8px;
  font-size: 11px;
}
.sync {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  border-top: 1px solid #edf0e9;
  padding-top: 17px;
  color: var(--muted);
  font-size: 12px;
}
time {
  text-align: right;
  color: #455c4e;
}
.notice {
  margin-top: 16px;
  padding: 11px 13px;
  background: #fff7e9;
  border-radius: 8px;
  color: #8b622a;
  font-size: 12px;
}
.connection-actions {
  border-top: 1px solid #edf0e9;
  margin-top: 16px;
  padding-top: 13px;
}
.connection-actions > summary {
  cursor: pointer;
  color: #506554;
  font-size: 12px;
  font-weight: 600;
  list-style: none;
}
.connection-actions > summary::after {
  content: " +";
  color: #9ca99a;
}
.connection-actions[open] > summary::after {
  content: " −";
}
.action-list {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 14px;
}
.action-list button {
  min-height: 38px;
  padding: 9px 12px;
  font-size: 12px;
}
.account-section {
  margin-top: 38px;
}
.section-intro {
  margin: -7px 0 19px;
  font-size: 13px;
}
.account-list {
  background: white;
  border: 1px solid var(--line);
  border-radius: 15px;
  overflow: hidden;
}
.account + .account {
  border-top: 1px solid #ebeee7;
}
.account > summary {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 75px;
  padding: 19px 23px;
  cursor: pointer;
  list-style: none;
}
.account-title {
  flex: 1;
  min-width: 0;
}
.account-name {
  display: block;
  font-size: 14px;
  font-weight: 550;
  overflow-wrap: anywhere;
}
.account-meta {
  display: block;
  margin-top: 5px;
  font-size: 11px;
  color: var(--muted);
}
.account-mask {
  color: #85917e;
  font-size: 12px;
}
.account > summary::after {
  content: "+";
  color: #98a392;
  font-size: 18px;
  margin-left: 5px;
}
.account[open] > summary::after {
  content: "−";
}
.preference-form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: start;
  gap: 22px;
  padding: 0 23px 23px;
}
.preference-checks {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 3px;
}
.preference-form button {
  grid-column: 1 / -1;
  justify-self: start;
}
.empty {
  padding: 30px;
  text-align: center;
  border: 1px dashed #cfd8ca;
  border-radius: 14px;
}
.empty strong {
  display: block;
  font-size: 14px;
  margin-bottom: 6px;
  font-weight: 600;
}
.empty p {
  font-size: 13px;
}
.site-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 20px 0 32px;
  border-top: 1px solid var(--line);
  color: #84907e;
  font-size: 11px;
}
.site-footer p {
  font-size: 11px;
}
.auth-panel {
  width: min(100%, 480px);
  padding: 32px;
  background: white;
  border: 1px solid var(--line);
  border-radius: 16px;
  margin: 25px auto 70px;
}
.auth-panel h1 {
  font-size: 28px;
  letter-spacing: -0.8px;
}
.auth-panel p {
  margin: 14px 0 24px;
  font-size: 14px;
}
.auth-panel form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
@media (max-width: 760px) {
  .shell {
    width: calc(100% - 36px);
  }
  .brand-bar {
    padding: 22px 0;
  }
  main {
    padding-top: 36px;
  }
  .connection-grid,
  .add-options {
    grid-template-columns: 1fr;
  }
  .add-options {
    gap: 24px;
  }
  .add-option + .add-option {
    padding: 22px 0 0;
    border-left: 0;
    border-top: 1px solid #d3ddce;
  }
  .connection-card {
    padding: 20px;
  }
  .preference-form {
    grid-template-columns: 1fr;
    gap: 18px;
  }
  .privacy {
    font-size: 11px;
  }
}
@media (max-width: 400px) {
  .status {
    padding: 5px 7px;
    font-size: 9px;
  }
  .institution-mark {
    width: 36px;
    height: 36px;
    font-size: 15px;
  }
  .connection-heading {
    gap: 9px;
  }
  .institution-name h3 {
    font-size: 16px;
  }
  .site-footer {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}
@media (prefers-reduced-motion: reduce) {
  button,
  .button {
    transition: none;
  }
}
`;
