# Strictly $0 setup and judging checklist

## Local build — complete without accounts

- Use Node 24; clone the public repository and run `npm ci`.
- Copy `.env.example` to ignored `.env.local`. Keep `AI_PROVIDER=manual` and `ALLOW_PAID_AI=false` initially.
- Run `npm run build && npm start`; open `http://localhost:3000`.
- Confirm `/api/health` returns `{"status":"ok"}` and manual receipt/split/invitation flows work.
- Keep the merchant browser cookie and `.data/` SQLite database. No cloud host is required.

## Real AI — user configuration required

- Create a Google AI Studio Free Tier project/key with **no linked billing account**. Do not enter a card or enable billing.
- Confirm current free access to `gemini-3.5-flash-lite` in that project/region. Stop if unavailable rather than upgrading.
- Add `GEMINI_API_KEY` securely to `.env.local` or environment secrets, set `AI_PROVIDER=gemini`, `GEMINI_MODEL=gemini-3.5-flash-lite`, and only after checking billing set `GEMINI_FREE_TIER_CONFIRMED=true`.
- Keep `ALLOW_PAID_AI=false`; leave optional OpenAI unused.
- Restart. Upload a genuine USD receipt, verify real extraction/correction, and test actual natural-language allocations.
- Quota error: wait or use manual mode. Never enable a paid fallback.

## Real PayPal Sandbox — user configuration required

- Create a free PayPal developer account, an eligible Sandbox business account/app and a separate Sandbox personal buyer. Use test balances only.
- Put the Sandbox client ID, secret and same business merchant/payer ID into the ignored environment file. No credentials go into chat, source or the video.
- Restart; independently approve a diner share, then authorize genuine PayPal checkout as the Sandbox buyer.
- Record actual order/capture IDs and exact paid/outstanding totals. Reopen the paid invitation to confirm duplicate prevention.
- Complete remaining shares and verify exact table closure.

## Optional free tunnel/webhooks

- Install official Cloudflare `cloudflared`; run `cloudflared tunnel --url http://localhost:3000 --protocol http2`.
- Set `APP_URL` to the actual temporary HTTPS URL, restart the app, and use that URL for browser actions.
- Verify public `/api/health` before registering the same Sandbox app's webhook URL `/api/webhooks/paypal`.
- Configure the returned `PAYPAL_WEBHOOK_ID`; restart. Subscribe to order-approved and capture-completed/denied/refunded/reversed events.
- Verify a real delivery signature and replay behavior. No interactive login/email gate may block the webhook.
- If the network refuses the tunnel, try the command on your local computer. No tunnel was verified in the managed build environment. Stop the tunnel afterward.

## Submission

- Run `npm test`, `npm run typecheck`, `npm run build`, `npm run smoke` and `npm run test:browser`.
- Record the **genuine** AI and Sandbox workflow in under three minutes. The included watermarked rehearsal is not proof of provider success.
- Upload the final video publicly to YouTube and add that URL to Devpost.
- Give judges complete setup plus an organizer-approved private method for necessary test-only access; never put keys in public GitHub.
- Confirm the public MIT repository and final commit. No hosting subscription is required by the reviewed rules.
- Submit only accurate claims. Genuine inference, Sandbox captures, live webhooks and final YouTube video remain pending until actually verified.
