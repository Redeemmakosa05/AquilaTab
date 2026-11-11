# AquilaTab — Scan. Split. Settle.

AI-powered item-level restaurant bill splitting with independently approved **PayPal Sandbox merchant payments**. Public MIT source, persistent local data, and no mandatory hosting subscription.

**$0 policy:** use manual mode or a billing-disabled Gemini Free Tier project, free PayPal developer/Sandbox accounts, and optional account-free Cloudflare Quick Tunnels. No paid Render service was created. Do not enable billing, add a credit card, or upgrade a service to continue. OpenAI is retained but disabled unless a separate paid-AI opt-in is deliberately enabled after approval.

**Verified:** 60 automated tests, TypeScript, production build, restart-persistence smoke checks, and 42 real Chromium desktop/mobile checks. **Still pending:** genuine Gemini inference, genuine PayPal Sandbox transactions/webhooks, and the final public YouTube demo. Credentials are not configured in this build environment. No AI answer or payment success is fabricated.

## Run locally — no keys or credit card needed

Use Node.js **24 LTS** and npm:

```sh
git clone https://github.com/Redeemmakosa05/AquilaTab.git
cd AquilaTab
npm ci
cp .env.example .env.local
npm run build
npm start
```

Open `http://localhost:3000`. For development, use `npm run dev` instead. Windows users can copy `.env.example` to `.env.local` in their file manager.

The initial fictional Olive Room bill is $143.75. Manually edit its receipt, add/remove diners, assign individual/shared items, choose equal or proportional charges, and confirm the reviewed split. John owes $56.60, Mary $44.58, and Alex $42.57 in the provided itemized scenario. Confirmation locks amounts and produces independent signed invitations. Diners can review their shares without keys, but actual checkout waits for Sandbox credentials.

Each dashboard visitor receives a separate merchant workspace via a secure HTTP-only cookie lasting 30 days. Keep that browser profile: clearing cookies loses access to its workspace. Guest invitations grant only share access. Team login and account recovery are outside this prototype.

## Enable real Gemini at $0

1. Sign in to [Google AI Studio](https://aistudio.google.com/api-keys) and create a project/key that explicitly shows **Free Tier** and has **no linked billing account**. Do not click Set up billing or supply a card. If your account/region requires paid access, stop and keep manual mode.
2. Confirm the reviewed model, `gemini-3.5-flash-lite`, is available on that project's current free tier. Google changes availability/quotas; the application cannot inspect your project's billing settings. The confirmation below is your operator attestation, not an automatic billing verification.
3. Set these entries in ignored `.env.local` or your server's secure environment settings, then restart:

```dotenv
AI_PROVIDER=gemini
GEMINI_API_KEY=YOUR_FREE_PROJECT_KEY
GEMINI_MODEL=gemini-3.5-flash-lite
GEMINI_FREE_TIER_CONFIRMED=true
ALLOW_PAID_AI=false
```

4. Upload a genuine, clearly identified USD receipt (JPEG/PNG/WebP, up to 6 MB), review the extraction, correct prices and uncertain fields, and test natural-language allocations.

Only the explicitly reviewed model is allowed in the zero-cost profile. Quota exhaustion stops the call; there is no fallback to another provider or paid model. Pricing lists this model's standard free-tier text/image input and text output as free; free access remains account- and quota-dependent. Gemini 2.5 Flash was not chosen because current documentation marks it deprecated and schedules automatic routing on December 1, 2026.

[Pricing](https://ai.google.dev/gemini-api/docs/pricing) · [Billing/tier management](https://ai.google.dev/gemini-api/docs/billing) · [Model](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite)

Free-tier inputs may be used to improve Google products under its terms. Use synthetic/non-sensitive receipts for this demonstration. The original image is sent to the configured provider for extraction and is not persisted by this server.

## Configure genuine PayPal Sandbox — free test accounts

1. Use [PayPal Developer](https://developer.paypal.com/dashboard/) to create an eligible Sandbox **business** account, such as a US test merchant, plus a separate Sandbox **personal buyer**. Use fake Sandbox balances and test accounts only. No real card or payment is required.
2. Create/select a **Sandbox REST app owned by that business account**. Put its client ID and secret into `.env.local` or secure environment settings. Set the same business account's merchant/payer ID, not its email or REST client ID:

```dotenv
PAYPAL_CLIENT_ID=YOUR_SANDBOX_APP_CLIENT_ID
PAYPAL_CLIENT_SECRET=YOUR_SANDBOX_APP_SECRET
PAYPAL_MERCHANT_ID=YOUR_SANDBOX_BUSINESS_MERCHANT_ID
```

3. Restart. Open a diner's signed invitation, explicitly approve the fixed share, click Pay with PayPal, and sign in as a **Sandbox personal buyer**. SDK v6 checks eligibility and launches a one-time session. The public client ID is intentionally used in the browser as current PayPal documentation recommends for standard checkout; client secrets and REST access tokens stay on the server.
4. After actual buyer approval, the backend captures and independently retrieves the canonical order. Only exact merchant/currency/allocation/amount and final completed capture matches count as paid. Inspect actual order/capture IDs and the partial outstanding balance. A paid invitation must not offer another checkout.
5. For webhooks, use the free temporary HTTPS instructions below. Register `https://YOUR-TUNNEL/api/webhooks/paypal` on the **same Sandbox REST app**, set its returned `PAYPAL_WEBHOOK_ID`, and restart. Subscribe to `CHECKOUT.ORDER.APPROVED`, `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.DENIED`, `PAYMENT.CAPTURE.REFUNDED`, and `PAYMENT.CAPTURE.REVERSED`.
6. Check real webhook deliveries and repeated delivery behavior. Use the merchant Reconcile action to recover verified captures after an interrupted callback. Finish all diner payments and verify $0 outstanding before claiming table closure.

Settings reports configuration presence, not a live validation. If setup requests real merchant onboarding, paid access or a card, stop. Zimbabwean production merchant acceptance is not claimed; use an eligible test merchant. Never paste keys or buyer passwords into chat, GitHub, screenshots, or a recording.

## Optional free HTTPS for temporary tests

[Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/) require no account, domain, or card. Install the official `cloudflared` binary using Cloudflare's free installation instructions. Keep the app running in one terminal and use another:

```sh
cloudflared tunnel --url http://localhost:3000 --protocol http2
```

Copy its actual `https://...trycloudflare.com` URL, set `APP_URL` in `.env.local` to that exact origin, and restart AquilaTab while leaving the tunnel running. Open the app through the **HTTPS tunnel URL** when creating/reviewing shares; using localhost with a different configured `APP_URL` correctly rejects mutations. Verify `/api/health` returns `{"status":"ok"}` through the tunnel before registering its webhook URL. Register/update PayPal's webhook whenever the tunnel URL changes. Keep `PAYPAL_WEBHOOK_ID` in the ignored environment file.

Do not add an interactive email/login gate to the webhook route: PayPal cannot pass it. Use synthetic data; anyone with the temporary URL can access the demo entry point, while merchant mutations and payment shares retain their own capability checks. Stop `cloudflared` to close access. The tunnel is temporary and is not a durable judging URL.

An actual tunnel attempt in this managed workspace failed at Cloudflare's registration endpoint with a TCP connection refusal. Local `/api/health` passed, but **no public tunnel URL or delivery was verified**. Try the documented command on your own computer/network; stop if it fails rather than switching to a paid product.

## Judge-run access

The [official rules](https://paypalaihackathon.devpost.com/rules) accept a functional runnable repository with complete instructions instead of public hosting. Judges still need access to the **actual working AI/payment workflow**, not just the manual UI.

- Manual inspection and all tests run without provider credentials.
- For real inference, use a billing-disabled Gemini Free Tier project as above.
- For real payment, use free Sandbox business/buyer accounts as above.
- Supply any entrant-provided **test-only** account access through the organizer-approved private judging/access channel; never commit API keys or login credentials to the public repository. Confirm with organizers that the chosen access method satisfies their testing requirement. Do not require judges to enable billing.
- The application/database live on the judge's computer. No persistent cloud hosting is required. A temporary tunnel is needed only for webhook/remote-device tests.

## Environment reference

| Variable | Purpose |
| --- | --- |
| `APP_URL` | Exact browser origin; defaults to localhost for local setup |
| `DB_PATH` | Persistent SQLite path, default `.data/aquilatab.sqlite` |
| `AI_PROVIDER` | `manual` by default; `gemini` for the zero-cost AI path; `openai` only after paid-AI approval |
| `GEMINI_API_KEY` | Server-only key from a billing-disabled free project |
| `GEMINI_MODEL` | Reviewed profile: `gemini-3.5-flash-lite` |
| `GEMINI_FREE_TIER_CONFIRMED` | Must be `true` only after checking the project's Free Tier and disabled billing |
| `ALLOW_PAID_AI` | Default `false`; keep false for this $0 submission |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | Retained optional OpenAI integration; blocked by default |
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` | Sandbox app credentials; only the public client ID is returned for SDK initialization |
| `PAYPAL_MERCHANT_ID` | Same test business account's merchant/payer ID |
| `PAYPAL_WEBHOOK_ID` | Same Sandbox app's registered webhook ID |

No live PayPal switch exists. No service enables billing automatically. Free-quota and project-billing status cannot be established from an API key alone.

## Financial and data integrity

All final calculations use integer cents and BigInt division/remainders. Itemized/shared allocations preserve exact totals; equal mode balances rounding across lines/charges. Tax/service/tip are equal or proportional; discounts follow item subtotals. Missing prices, unreadable totals, uncertainty, duplicates, quantity mismatches, unassigned items and inconsistent totals block confirmation. AI returns proposals only; humans approve and deterministic code calculates.

Confirmation locks the bill and creates HMAC-signed, database-bound invitations valid for four hours. The signing secret, sessions, bills and captures persist in SQLite. A stable request ID is used per order and capture; browser callbacks or redirects cannot mark a share paid. Canonical order IDs, invoice IDs, merchant IDs, USD amounts, final capture IDs and statuses are validated. Duplicate deliveries do not increment totals. Approval without capture remains unpaid. Refund/reversal events reopen a share for review and conservatively exclude its full amount; automated partial-refund accounting/replacement charges are outside scope.

Use one Node 24 process and a persistent local filesystem. Keep `.data/` private and back it up with SQLite-aware tooling, including active WAL state. Team recovery, production merchant onboarding, multi-replica deployment and live payments are outside this prototype. Existing Docker/Compose examples remain optional local tools, not a paid deployment plan; they have not been executed here.

## Tests, browser QA and video

```sh
npm test
npm run typecheck
npm run build
npm run smoke
npx playwright install chromium
npm run test:browser
```

Browser QA uses an installed `/usr/bin/chromium` when available, or Playwright's downloaded Chromium. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` if needed. The QA runner starts a temporary local production server/database and forcibly disables all provider credentials. Its images/report are written to ignored `.qa-artifacts/`; it never fabricates a paid state.

The executed results are **60 automated tests**, production build/type checks, five restart-persistence HTTP checks and **42 Chromium checks** at desktop 1440×1000 and emulated mobile 390×844/360×800, with no page exceptions or horizontal overflow. Physical iOS/Android, genuine Gemini/OpenAI calls and genuine PayPal SDK/buyer/webhook flows remain unverified. Provider unit tests mock responses and do not establish live success.

A clearly watermarked [manual rehearsal](docs/media/manual-rehearsal.webm) demonstrates the real local interface and explicitly shows that AI/payment credentials are pending. It is **not the final live-integration video**. Re-record the genuine workflow using [the under-three-minute plan](docs/DEMO.md), then upload the final video publicly to YouTube as the official rules require. No YouTube upload or Devpost submission has been made.

## Submission and source

- [Official rules](https://paypalaihackathon.devpost.com/rules)
- [Free setup checklist](docs/SETUP-CHECKLIST.md)
- [Verification evidence](docs/VERIFICATION.md)
- [Integration documentation review](docs/INTEGRATION-REVIEW.md)
- [Final submission checklist](docs/SUBMISSION-CHECKLIST.md)
- [Devpost draft](docs/DEVPOST.md)
- [Demo plan](docs/DEMO.md)
- [MIT license](LICENSE)
- [Download source ZIP](https://github.com/Redeemmakosa05/AquilaTab/archive/refs/heads/main.zip)

Each milestone is committed, pushed and checked against the remote branch. A ZIP only in the temporary workspace is never treated as a permanent backup. This submission is **not yet live-integration verified**.
