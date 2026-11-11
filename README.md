# AquilaTab — Scan. Split. Settle.

AI-powered item-level restaurant bill splitting with independently approved, directly reconciled **PayPal Sandbox merchant payments**.

**Status:** The implementation, tests, and source are backed up to this public repository. Real OpenAI and PayPal verification remains blocked by missing credentials. Visual browser QA and public deployment are unverified. This is not yet a verified live hackathon submission.

The Olive Room is fictional. Initial bills and diners are synthetic and entirely unpaid. No successful AI response or payment is simulated in the application.

## What works independently of provider credentials

- Merchant dashboard with active tables, itemized bills, QR destinations, paid/outstanding balances, diner statuses, and audit events.
- Editable receipt details, manual corrections, diner management, individual/shared item assignments, equal splitting, charge distribution, and exact reconciliation.
- Confirmation locks the bill and creates one signed, expiring invitation per diner. Diners independently review their assigned items before payment.
- Persistent SQLite records, isolated merchant sessions, optimistic version checks, authorization, same-origin mutation protection, and rate limiting.

## Implemented provider integrations

- OpenAI multimodal receipt extraction and strict structured allocation proposals; nullable prices and uncertainty block confirmation until reviewed. The model cannot initiate payments or decide final monetary amounts.
- Official **PayPal JavaScript SDK v6**, with a browser-safe client token, eligibility checks, a one-time payment session, and explicit buyer interaction.
- Distinct Orders v2 orders, server-side capture, independent canonical order/capture verification, signature-verified webhooks, stable request IDs, replay protection, duplicate-payment prevention, and partial/full table reconciliation.

Provider contract tests mock responses. They do not prove a real API key, merchant account, Sandbox buyer, SDK popup, or live webhook works.

## Quick start

Use **Node.js 24 LTS** and npm. SQLite uses Node's built-in module; an experimental-module notice can appear.

```sh
git clone https://github.com/Redeemmakosa05/AquilaTab.git
cd AquilaTab
npm ci
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. Set `APP_URL` to the exact browser origin, including its port. No keys are needed for the manual workflow. Scan/AI operations and Sandbox checkout show clear setup errors until configured.

The first dashboard visit creates a separate merchant workspace using a cryptographically random, HTTP-only cookie. The cookie lasts 30 days and is secure in production. Keep that browser profile: clearing cookies loses access to that workspace and creates a new one. Opening a diner invitation does not create a merchant session. Opening the dashboard in a second browser creates a different merchant workspace. Team login, account recovery and production merchant onboarding are outside this prototype.

## Configuration

Copy `.env.example` to `.env.local` for local development. On a host, set runtime environment variables through its secret settings. Never paste secret values into a chat or the application.

| Variable | Purpose |
| --- | --- |
| `APP_URL` | Exact origin, such as `http://localhost:3000` or a hosted HTTPS origin |
| `DB_PATH` | Persistent local SQLite path, default `.data/aquilatab.sqlite` |
| `OPENAI_API_KEY` | Server-only OpenAI key with model access and billing |
| `OPENAI_MODEL` | Default `gpt-4.1-mini`; must support images and strict JSON schema |
| `PAYPAL_CLIENT_ID` | Sandbox REST app client ID, retained on server in this implementation |
| `PAYPAL_CLIENT_SECRET` | Server-only Sandbox REST app secret |
| `PAYPAL_MERCHANT_ID` | Eligible Sandbox business account's merchant/payer ID |
| `PAYPAL_WEBHOOK_ID` | Registered webhook ID for the same Sandbox REST app |

Settings & integrations reports configuration presence, not a verified live connection. Restart the server after changing environment variables. There is no live-payment switch; REST and SDK environments are fixed to Sandbox.

## AI setup and data handling

1. Configure `OPENAI_API_KEY` on the server and a supported model. If provisioning through ChatGPT, enable OpenAI Developers and follow its key-approval workflow.
2. Upload a clearly identified USD receipt as JPEG, PNG or WebP, up to 6 MB. File signatures and size are validated. Only the uploaded image is sent to OpenAI for extraction; the original image is not stored by the server. Review the provider's retention controls before uploading personal receipts.
3. Review item names, quantities, unit and line prices, charges, discounts, total and uncertainty. Missing prices remain null. Confirming an uncertainty flag does not bypass missing-price or arithmetic checks.
4. Add diners and request a split. The model receives item/diner IDs and instruction text; receipt names and text are treated as untrusted data. It returns assignments and a charge policy only. Server code validates all IDs and calculates all cents.
5. Review the proposal before locking the bill. No AI output has authority to create or capture a PayPal order.

Duplicate item names/IDs, missing prices, quantity arithmetic mismatches, unassigned items, possible duplicated service charges and total discrepancies block finalization. Legitimate duplicate lines can be consolidated into a correct quantity or distinguished manually. Unsupported or unidentifiable currencies are rejected instead of silently becoming USD.

## PayPal Sandbox setup

1. Open [PayPal Developer](https://developer.paypal.com/dashboard/) and create an eligible Sandbox **business** account, such as a US test merchant. Create separate Sandbox **personal buyer** accounts. Do not use live accounts.
2. In Apps & Credentials, choose **Sandbox** and create/select an app owned by that business account. Configure its client ID and secret on the server.
3. Set `PAYPAL_MERCHANT_ID` to that business account's actual merchant/payer ID. It is not the client ID or email address. Orders explicitly name this recipient and verify the returned merchant ID.
4. Restart the app. Confirm the three Sandbox variables are present in Settings. A diner must approve their share before the server issues a browser-safe SDK token or order.
5. Publish the Node app behind HTTPS with persistent storage. Set `APP_URL` to its exact origin and restart. The v6 browser client token is domain-scoped to this host.
6. Register `https://YOUR_HOST/api/webhooks/paypal` on the **same Sandbox app**. Subscribe to `CHECKOUT.ORDER.APPROVED`, `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.DENIED`, `PAYMENT.CAPTURE.REFUNDED`, and `PAYMENT.CAPTURE.REVERSED`. Configure the returned `PAYPAL_WEBHOOK_ID` and restart.
7. Ensure deployment-wide authentication does not block the webhook with an interactive login page. The webhook route performs PayPal signature authentication itself.
8. Open a diner invitation in a separate browser/device. Approve the fixed share, click Pay with PayPal, log in as a Sandbox buyer, and explicitly authorize the payment. Wait for verified capture before claiming success.
9. Inspect the real order/capture IDs and partial balance. Reopen the paid link: it must show a verified receipt without checkout. Use the merchant Reconcile action to recover a canonical completed capture after an interrupted callback or webhook.
10. Complete the other diners' payments and verify exact full settlement. Record actual results; never edit payment records to manufacture the judging scenario.

If business-account setup, browser-safe client-token issuance, buyer eligibility or checkout fails, record the exact provider error. Current test results do not establish that these configurations succeed. PayPal documentation lists Zimbabwe as send-only for merchant receipts; this prototype does not claim production Zimbabwean merchant acceptance.

## Money and payment integrity

All authoritative amounts are integer minor units. BigInt division/remainders avoid floating-point products. Itemized mode divides each line among its assigned diners in stable order. Equal mode balances remainder cents across every line and charge so equal shares differ by at most a cent in ordinary equal, undiscounted bills. Tax/service/tip can be equal or proportional to assigned item subtotals; equal mode forces equal charges. Discounts follow item subtotals. Every share must be positive and the sum must exactly match the printed total.

Confirmation atomically locks amounts and generates HMAC-signed, database-bound invitations valid for **four hours**. The signing secret is cryptographically generated and stored only in SQLite so signatures survive restarts. Links are bearer capabilities: share privately. There is no silent token renewal or replacement-charge override.

States: `PENDING → CREATING → CHECKOUT → APPROVED → PAID`, plus `CANCELLED`, `FAILED`, `REFUNDED`, and `REVERSED`. An uncertain order-creation response retries with the same request ID throughout the invitation window; it does not create a second attempt. Cancellation safely reuses the existing order. Approval without completed capture is unpaid. Failed statuses come from authenticated denial events; browser/network errors display an error without guessing a financial result.

Capture validation checks the stored order ID, exactly one purchase unit, allocation ID, bill/share invoice ID, USD amount, and merchant recipient. A separate GET after capture verifies a single completed, final, exact-amount capture. Order/capture IDs are unique in SQLite. Duplicate requests or webhook deliveries do not increment totals. No redirect or browser assertion marks payment complete.

Refund/reversal events reopen the share for merchant review and exclude its entire amount from verified settlement, even for partial refunds. Automatic partial-refund accounting, new replacement charges, settlement payouts and production dispute management are outside scope.

## APIs and SDK

- OpenAI `POST /v1/chat/completions`, images plus strict JSON schema.
- PayPal `POST https://api-m.sandbox.paypal.com/v1/oauth2/token` for server access; `response_type=client_token` and `domains[]` for a browser-safe SDK token. REST access tokens and client secrets never go to the browser.
- `POST /v2/checkout/orders`, one immutable share per order, with `PayPal-Request-Id`.
- `GET /v2/checkout/orders/{id}` for canonical validation and reconciliation.
- `POST /v2/checkout/orders/{id}/capture`, with a distinct stable request ID.
- `POST /v1/notifications/verify-webhook-signature` before processing every event.
- Official SDK v6 through `@paypal/paypal-js/sdk-v6`, loading `https://www.sandbox.paypal.com/web-sdk/v6/core`, checking eligibility and starting `createPayPalOneTimePaymentSession` on explicit button click. `start()` receives a Promise resolving to `{orderId}`.

References: [Orders v2](https://developer.paypal.com/docs/api/orders/v2/), [SDK v6 setup](https://developer.paypal.com/sdk/js/set-up/), [Webhooks](https://developer.paypal.com/docs/api/webhooks/v1/), [Payment Links and Buttons](https://developer.paypal.com/api/payment-links-buttons/). Optional merchant-hosted reusable payment links were considered; signed diner invitations with fixed Orders v2 allocations provide tighter one-share reconciliation and duplicate controls. This application does not use reusable merchant payment links.

## Verification

```sh
npm test
npm run typecheck
npm run build
npm run smoke
```

The executed result is **49 tests passed**, TypeScript passed, production build passed, and five real HTTP smoke checks passed. HTTP tests verify served assets, real secure session cookies, unauthorized-write rejection, independent invitations, honest missing-provider states, and SQLite persistence across a process restart. `npm audit --omit=dev` reported zero production dependency vulnerabilities.

OpenAI and PayPal unit tests mock network responses. Actual image inference, real Sandbox checkout/capture, live webhook delivery, multi-device browser checkout and responsive visual behavior remain unverified. The managed browser tool and Sites helper scripts were absent; no preview/browser path was improvised. See [verification](docs/VERIFICATION.md).

## Persistent deployment

Run one Node 24 process with a persistent local filesystem and writable `DB_PATH`. Do not use an ephemeral/serverless filesystem, independent replicas, or SQLite on a network filesystem. Back up SQLite with database-aware tooling; copying only the main file while WAL writes are active is not a consistent backup. Merchant sessions and the signing secret are in the database: keep it private and preserve it across restarts.

For a Node host, run `npm ci`, `npm run build`, then `npm start` with production environment variables and an HTTPS reverse proxy. Next.js standalone output is also generated. Dockerfile/Compose examples are included but have not been executed here. Compose binds loopback and stores SQLite in a named volume; configure TLS and public webhook access before sharing.

There is **no verified deployed demo URL**. The available Sites runtime targets Cloudflare Workers, which cannot run this Node/SQLite build unchanged, and its setup helpers were absent. Use a persistent Node host or explicitly port the database/runtime before deploying there. GitHub source is already public; hosting credentials are not available.

## Permanent source and downloads

Each milestone was committed, pushed and verified against `origin/main` before continuing. Download current source using GitHub's **Code → Download ZIP**, or pin a specific commit from the repository history. Generated build files, runtime database, secrets and dependency directories are excluded. The blank `.env.example` template is intentionally public.

- Repository: https://github.com/Redeemmakosa05/AquilaTab
- Current branch ZIP: https://github.com/Redeemmakosa05/AquilaTab/archive/refs/heads/main.zip
- [Setup checklist](docs/SETUP-CHECKLIST.md)
- [Devpost description](docs/DEVPOST.md)
- [Under-three-minute demo plan](docs/DEMO.md)
- [Milestone checkpoint](docs/CHECKPOINT.md)
- MIT [LICENSE](LICENSE)
