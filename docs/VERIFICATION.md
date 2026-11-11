# Verification — November 11, 2026

Continuation starts from `ace78c6b2e1eef22c9b6ce5976847773e3c5c709`; the implementation was preserved and fixed incrementally.

## Executed results

| Check | Result |
| --- | --- |
| Core monetary/receipt tests | 10 passed |
| OpenAI schema contracts | 9 passed; network mocked |
| Gemini free-tier/policy contracts | 9 passed; network mocked |
| PayPal security/contract tests | 18 passed; network mocked |
| Application route tests | 14 passed; Next cookie accessor mocked |
| Total `npm test` | **60 passed** |
| TypeScript | Passed |
| Optimized production build | Passed, Next.js 16.4.6 / Node 24.22.1 |
| Production HTTP smoke | Five checks passed, including restart persistence |
| Chromium UI QA | **42 checks passed**, Chromium 156.0.8078.79 |
| Production dependency audit | Zero reported vulnerabilities |

The HTTP test starts a temporary local production server and verifies served HTML/JS/CSS, real secure HTTP-only session cookies, unauthorized writes, exact-sum invitations, explicit diner review, honest missing-credential states and persistence after a full server restart. Temporary test databases are removed; no actual merchant records are edited.

## Browser evidence

`scripts/browser-qa.mjs` uses actual Chromium against the built Next.js server, with no intercepted/mocked AI or PayPal success responses. Credentials are deliberately cleared. Viewports: **1440×1000 desktop**, **390×844 mobile emulation**, **360×800 mobile emulation**.

The scenarios exercise dashboard navigation; QR destinations; modal keyboard focus trap/Escape; receipt correction and invalid-total blocking; actual image-upload request with truthful manual-AI rejection; diner add/remove; equal/itemized/shared allocations; proportional charges; confirmation and amount locks; three independent invitations; a separate diner browser context; approval persistence on reload; PayPal setup-required state; table page; invalid invitation rejection; activity; integrations; and new-table creation.

All tested screens had no horizontal overflow, and no `pageerror` events occurred. A baseline run reproduced a **missing accessible name on the mobile scan button** because its visible text was hidden at the mobile breakpoint. Adding an explicit label fixed it; the full regression run passes.

- [Machine-readable browser report](qa/browser-report.json)
- [Desktop dashboard](qa/desktop-overview.png)
- [Mobile diner page](qa/mobile-diner.png)

These are real Chromium tests with mobile emulation, not physical iOS/Android or Safari verification.

## Documentation-driven fixes

- Standard PayPal SDK v6 checkout now uses the documented public `clientId`, with secrets and REST access tokens kept server-side.
- Unreadable AI grand totals can be null in the model schema and are explicitly rejected before financial use.
- The default AI mode is manual. Gemini requires a billing-disabled Free Tier confirmation, the reviewed model and a key. OpenAI requires a separate paid-AI opt-in and remains disabled for the $0 profile.
- `/api/health` checks SQLite readiness without creating a merchant session or exposing configuration.

## Free tunnel investigation

The official `cloudflared` 2026.10.7 Linux binary was verified against its GitHub-published SHA-256. A real attempt used a temporary local application/database with provider credentials disabled. Local health passed. Cloudflare registration failed with `dial tcp 104.16.231.132:443: connect: connection refused`. No public URL was allocated or health-verified. Both local processes were stopped. No paid service was enabled. README instructions explain how to retry the free command on the entrant's own computer/network.

## Video

A real browser recording of the manual local workflow is included as [manual-rehearsal.webm](media/manual-rehearsal.webm). The file duration is verified under 180 seconds. Its persistent caption says no AI inference or PayPal transaction was performed; missing-provider states are shown honestly. It is a rehearsal, not the final genuine integration video. No YouTube publication or Devpost submission has been made.

## Remaining verification gates

No Gemini key, OpenAI key, PayPal Sandbox REST app credentials, merchant ID, webhook ID or buyer login was available. Genuine receipt inference, real natural-language generation, genuine PayPal order/approval/capture, live webhook delivery/signature verification and account eligibility remain **unverified**. Unit tests mocking providers do not establish any of those results.

No paid Render resources or other paid services were created. Local/GitHub judging is the selected submission route. The entrant must configure free accounts, verify genuine provider behavior and record/upload the final video before claiming a complete live demonstration.
