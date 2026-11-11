# Final recording plan — 2 minutes 45 seconds

The included [manual rehearsal](media/manual-rehearsal.webm) is real local browser footage, explicitly watermarked **no AI inference or PayPal transaction performed**. It is not the final submission video. It can be recreated with `npm run build`, `npx playwright install chromium ffmpeg`, and `npm run record:demo` (output in ignored `.qa-artifacts/rehearsal/`). No music, paid editor or credit card is needed.

Before final recording, configure a billing-disabled Gemini Free Tier project and free PayPal Sandbox merchant/buyer accounts, then actually verify them. Use an optional free Cloudflare tunnel for webhook/mobile tests if your network supports it. Keep all secrets, buyer login/password fields and token-bearing address bars out of the final footage.

Record with a free local screen recorder such as OBS or an operating-system recorder. Prepare test-only buyer sessions in advance. Do not use cuts to pretend a failed or mocked transaction succeeded. Provider latency may require shortening the introduction.

| Time | Actual footage and narration |
| --- | --- |
| 0:00–0:12 | Dashboard and fictional restaurant/table QR. “One bill, three diners, each paying the restaurant directly.” |
| 0:12–0:38 | Upload a genuine USD receipt and wait for a real Gemini extraction. Correct an actual uncertain field and show the printed total. If inference fails, stop; do not insert a fake response. |
| 0:38–1:02 | Ask real AI for John/burgers, Mary/pizza, Alex/pasta, shared sides/drinks and equal charges. Show human review and exact reconciliation. The provided sample totals are $56.60 + $44.58 + $42.57 = $143.75; use the actual uploaded receipt's amounts when different. |
| 1:02–1:18 | Confirm amounts and open John's separate invitation. He reviews and approves only his share. |
| 1:18–1:48 | Click the official SDK v6 checkout button and explicitly authorize a genuine Sandbox buyer payment. Show the verified real capture ID, without credentials. No completion screen counts as paid until backend verification succeeds. |
| 1:48–2:10 | Return to the dashboard: John's actual verified share reduces the total while other diners remain unpaid. Reopen his paid link to show duplicate prevention. For the sample, $56.60 paid leaves $87.15. |
| 2:10–2:28 | Show a real cancellation or verified webhook activity if available. Cancellation without capture stays unpaid. Do not claim unobserved denial/refund behavior; it is covered by contract tests only. |
| 2:28–2:45 | Show the GitHub repository, local judge-run instructions and $0 setup. “AI interprets who had what. People approve. PayPal processes and verifies each independent merchant payment.” |

The full table can be settled in an additional rehearsal; prioritize one real payment and genuine partial settlement within the video limit. Do not claim all diners paid unless every capture is confirmed.

## Publication and submission

1. Check the finished video is **less than 180 seconds** and contains no secrets, real personal data or unlicensed music.
2. Upload it **publicly to YouTube** using the entrant's free account. A repository WebM alone does not satisfy the reviewed public-YouTube rule.
3. Put the actual YouTube link in Devpost. Use the runnable repository route instead of a paid hosted URL.
4. Provide necessary test-only access through an organizer-approved private channel; do not publish keys in GitHub.
5. Complete [the final checklist](SUBMISSION-CHECKLIST.md), then submit only true, observed results.
