# Official documentation review — November 11, 2026

## PayPal

[SDK v6 setup](https://developer.paypal.com/sdk/js/set-up/) explicitly recommends `clientId` for standard one-time checkout. The app now initializes the official sandbox SDK with its public client ID and `paypal-payments`, checks eligibility, and starts a one-time session from a buyer click with a Promise resolving to `{orderId}`. The client secret and REST OAuth tokens remain server-only. The previous browser-safe client-token path was removed from this standard checkout flow; the SDK documentation identifies it with Fastlane-specific authentication.

[Orders v2](https://developer.paypal.com/api/orders/v2) documents create, retrieve and capture operations used by this app. Server amounts, payee, custom/invoice references and canonical captures remain authoritative. [Webhooks](https://developer.paypal.com/api/webhooks/v1) provides the signature-verification endpoint used before processing events. Idempotency and duplicate guards remain in place.

These are documentation/contract checks, not genuine Sandbox account or transaction verification. A free business app, independent Sandbox personal buyer and optional publicly reachable webhook are still required. No real funds/card are needed for Sandbox.

## Gemini and the $0 profile

The [Gemini pricing page](https://ai.google.dev/gemini-api/docs/pricing) lists standard free-tier text/image inputs and text outputs for `gemini-3.5-flash-lite`. Its [model page](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite) lists image inputs and structured outputs. The [generateContent reference](https://ai.google.dev/api/generate-content) documents inline data and JSON response configuration used by the adapter. Current docs also expose newer Interactions workflows; this implementation uses the documented generateContent REST contract and validates its candidate text with the existing Zod schemas.

[Billing documentation](https://ai.google.dev/gemini-api/docs/billing) distinguishes free projects from linked paid billing accounts. The server requires an operator confirmation that the selected project has billing disabled, restricts the reviewed model, and stops on quota errors. It cannot independently verify a Google project's billing configuration from its key. The user must check current availability and stop if a card/billing upgrade is requested. Gemini 2.5 Flash is documented as deprecated with December 1 automatic routing, so it was not selected for judging.

No genuine Gemini response has been obtained; the key is missing. The adapter tests mock provider responses. Free-tier data may be used for product improvement under Google's terms: use synthetic/non-sensitive receipts.

## Retained OpenAI path

[Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) and [image inputs](https://developers.openai.com/api/docs/guides/images-vision) support the existing image content and JSON-schema approach. Refusal, non-stop completion and invalid JSON are rejected. Unreadable totals are now explicitly nullable in the model schema and rejected before financial confirmation rather than forcing an invented number.

OpenAI is blocked by default regardless of whether a key exists. It requires both `AI_PROVIDER=openai` and a deliberate `ALLOW_PAID_AI=true`; this flag must remain false for the user's $0 submission. No OpenAI calls were made.

## Temporary HTTPS

[Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/) provide a temporary HTTPS URL without an account/domain. The official `cloudflared` 2026.10.7 Linux asset was downloaded and its GitHub-published SHA-256 verified. The local app health check succeeded, but tunnel registration failed with `connect: connection refused` to Cloudflare's HTTPS registration endpoint in this environment. No public URL or webhook delivery was verified; no paid alternative was enabled. Commands for testing on the user's local network are in the README.
