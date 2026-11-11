# Before the live judging demonstration

- Clone this GitHub repository and use Node 24; run `npm ci`.
- Copy `.env.example` to `.env.local`; configure exact `APP_URL` and persistent `DB_PATH`.
- Configure a supported OpenAI model, API key and billing on the server. Restart and test a real USD receipt.
- Create an eligible PayPal Sandbox business account and its Sandbox REST app.
- Configure that app's client ID/secret and the same business account's merchant/payer ID.
- Create separate Sandbox personal buyer accounts. Never use live users or live payments.
- Deploy one Node process behind HTTPS with persistent SQLite storage and restart with the correct `APP_URL`.
- Register `/api/webhooks/paypal` on the Sandbox app; configure `PAYPAL_WEBHOOK_ID` and restart.
- Subscribe to approval, capture completed/denied/refunded/reversed events. Ensure no interactive site-wide login blocks the webhook.
- Test SDK v6 browser-safe client-token issuance and PayPal eligibility with the actual Sandbox app.
- Upload a genuine USD receipt, correct uncertainties and verify totals.
- Use real natural-language inference and confirm the resulting non-equal shared-item allocation.
- Create invitations and independently review each diner share.
- Complete a genuine Sandbox payment. Record the actual order/capture IDs and recipient.
- Show other shares pending, partial paid/outstanding totals and duplicate prevention on the paid invitation.
- Cancel another checkout without marking it paid. If a real decline cannot be reproduced, identify failure handling as contract-tested only.
- Complete remaining genuine payments. Confirm all captures reconcile exactly before table closure.
- Verify live signature-authenticated webhooks and replay protection.
- Run desktop/mobile browser QA, then `npm test`, `npm run typecheck`, `npm run build`, `npm run smoke`.
- Record the demo and commit/push any fixes; verify the final SHA on GitHub.

Never paste secret values into chat, source, issue descriptions or browser fields. If account provisioning fails, record the exact error and leave the transaction unconfirmed. Zimbabwean production merchant acceptance is not established by this Sandbox prototype.
