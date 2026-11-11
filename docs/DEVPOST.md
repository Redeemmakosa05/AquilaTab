# AquilaTab — Scan. Split. Settle.

## Elevator pitch
AI-powered, item-level restaurant bill splitting where each diner independently pays their exact share directly to the restaurant through PayPal Sandbox.

## Inspiration
A shared meal should not end with one person paying everything and chasing reimbursements. AquilaTab turns one itemized bill into independently approved merchant payments.

## What it does
A table QR opens the correct bill. Receipt understanding and natural-language AI propose item allocations; diners correct uncertain data and review their portions. Deterministic integer-cent code assigns shared food, charges and rounding without losing a cent. Each diner receives an expiring invitation and explicitly approves official PayPal SDK v6 checkout. Canonical capture verification and authenticated payment events reconcile the restaurant's partial and full settlement.

## How we built it
Next.js, TypeScript, React, Zod, SQLite, Gemini structured image/text outputs, retained optional OpenAI integration, PayPal Orders v2, official SDK v6 and webhook signature verification. Merchant ownership, fixed server amounts, HMAC invitations, stable idempotency IDs and unique capture records protect the financial workflow. AI never creates or captures payments.

## Why PayPal matters
Every approved allocation maps to a distinct merchant-bound order and verified capture. No platform balance, escrow or personal reimbursement transfer is used. The restaurant's outstanding amount changes only when canonical PayPal data confirms the exact payment.

## $0 and reproducibility
The GitHub repository is public under MIT, with complete local setup. No paid hosting is required under the reviewed rules. Manual mode runs without keys; real Gemini use requires a billing-disabled Free Tier project, while PayPal uses free developer/Sandbox accounts. A free temporary tunnel can support webhook tests. OpenAI is disabled by default; there is no paid fallback.

## Verified engineering status
60 automated tests, TypeScript, production build, restart-persistence smoke checks and 42 real Chromium desktop/mobile checks pass. A mobile accessibility defect and the SDK authentication setup were fixed. Source changes are pushed and remotely verified.

## Mandatory status to update before final submission
Genuine Gemini inference, genuine PayPal Sandbox buyer approval/capture and live webhook delivery remain unverified because provider credentials are missing. The included watermarked manual-workflow video is a rehearsal and is not evidence of those integrations succeeding. The managed environment could not establish a free tunnel due to a connection refusal. No public hosting URL, final public YouTube video or Devpost submission is claimed.

**Repository:** https://github.com/Redeemmakosa05/AquilaTab

**Functional-demo access:** README local setup and organizer-approved private test-access instructions to be completed by the entrant.

**Public YouTube video:** pending the genuine integration recording and entrant upload.

The Olive Room is fictional, USD and eligible Sandbox test merchants are supported, and Zimbabwean production merchant acceptance and official PayPal affiliation are not claimed. Keep these limitations accurate; do not replace pending results with simulated success.
