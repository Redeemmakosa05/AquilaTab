# AquilaTab — Scan. Split. Settle.

## Pitch
AI-powered, item-level bill splitting where each diner independently pays their exact share directly to the restaurant through PayPal Sandbox.

## What it does
A table QR opens the correct bill. OpenAI extracts receipt items and proposes allocations from ordinary instructions. Users correct uncertain data, assign shared food and review their amounts. Deterministic integer-cent code reconciles every share, including charges and rounding. Each diner receives an expiring invitation and explicitly approves SDK v6 checkout. The merchant sees partial settlement and closes the table only after all exact captures are verified.

## Why PayPal is central
Every allocation maps to a distinct Orders v2 order with a fixed amount, merchant recipient and stored transaction IDs. Server capture, canonical amount/recipient verification, signature-authenticated webhooks and idempotent reconciliation underpin the settlement dashboard. No shared platform balance, escrow or personal reimbursement transfer is used.

## Built with
Next.js, TypeScript, React, Zod, SQLite, OpenAI multimodal structured outputs, PayPal Orders v2, official JavaScript SDK v6, server capture and webhook signature verification. Source is public under MIT and each milestone is committed and remotely verified.

## Differentiation
Item-level AI allocations and shared food handling lead to independent direct merchant payments and verified table reconciliation rather than a reimbursement chain.

## Submission status — update only after real verification
The source implementation, 49 automated tests, production build and restart-persistence HTTP checks are complete and GitHub-backed. Provider tests use mocked responses. Real AI inference, Sandbox account eligibility, SDK buyer approval/capture and live webhook delivery remain unverified because credentials were unavailable. Browser visual QA and public deployment are also pending. This record must not be presented as a successful live demonstration.

The Olive Room is fictional. USD and an eligible Sandbox test merchant are supported. Zimbabwean production merchant receipt capability and official PayPal affiliation are not claimed.
