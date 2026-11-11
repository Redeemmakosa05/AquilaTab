# AquilaTab — Scan. Split. Settle.

AI-powered item-level restaurant bill splitting with independently approved PayPal Sandbox merchant payments.

This is a fresh implementation. The Olive Room is fictional; all initial bills are synthetic and unpaid. GitHub is the permanent source of truth. Every milestone is committed, pushed, and checked remotely before further development.

## Planned implementation

Next.js, TypeScript, Zod, Node 24 SQLite, OpenAI multimodal structured outputs, PayPal Orders v2, official JavaScript SDK v6, server capture verification, and authenticated webhooks.

## Status

Milestone 1: core manual application implemented; 10 monetary tests and production build pass. AI and PayPal integration are pending. No real AI or PayPal credentials are configured; live integration verification will require server environment configuration. Never commit secrets or private receipts. Setup placeholders are in `.env.example`.

## License

MIT. See `LICENSE`.

## Local development

Requires Node 24. Run `npm ci`, copy `.env.example` to `.env.local`, and run `npm run dev`. Open http://localhost:3000. The SQLite database is ignored under `.data/`.
