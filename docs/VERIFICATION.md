# Verification — November 11, 2026

Runtime: Node.js v24.22.1, Next.js 16.4.6. This is an executed engineering record, not evidence of live provider transactions.

## Passed

| Check | Result |
| --- | --- |
| Core money/receipt tests | 10 passed |
| OpenAI contract tests | 8 passed, provider mocked |
| PayPal contract/security tests | 18 passed, provider mocked |
| Application route tests | 13 passed, Next cookie accessor mocked |
| `npm run typecheck` | Passed |
| `npm run build` | Passed |
| `npm run smoke` | Five production HTTP checks passed |
| `npm audit --omit=dev` | Zero reported production vulnerabilities |

Coverage includes rounding and sum preservation, individual/shared/equal distributions, tax/service/tip/discount handling, manual corrections, uncertainty/schema validation, duplicate/missing fields, unknown allocations, file validation, merchant ownership, session isolation, CSRF, stale versions, bill locks, independent diner review, signed/expired invitations, client order substitution, over/underpayment, merchant/currency/allocation/capture validation, approved-but-uncaptured states, cancellation, provider errors, authenticated denial, duplicate capture, webhook signature verification/replay, partial/full settlement, refunds/reversals and missing credentials.

The HTTP smoke test starts the optimized production server on loopback solely for tests, verifies production HTML/JavaScript/CSS, secure HTTP-only cookies, unauthorized writes, exact independent shares and review, then restarts the whole process and verifies persisted sessions, locked bills, invitations and approvals. Temporary data is removed after the test; no merchant or financial production records are altered.

## Unverified and blocked

No OpenAI or PayPal credentials were configured. Actual receipt inference, natural-language model output, eligible Sandbox account setup, browser-safe token issuance, SDK popup/buyer authorization, genuine Orders/Capture calls, live webhook signature verification and delivery have not been demonstrated.

The required managed browser control tool was absent. Desktop/mobile visual behavior, accessibility in a browser, real QR/camera behavior and multiple real browser sessions have not been tested. Source contains responsive layouts and keyboard-accessible controls, but those do not establish browser QA success.

No public Node hosting credentials or compatible deployment target were configured. Sites setup helpers were absent and its Worker runtime cannot run Node SQLite unchanged. No deployment URL is claimed. Docker examples have not been built or run. A genuine live judging demonstration remains pending.
