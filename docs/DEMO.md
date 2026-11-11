# Demo plan — 2 minutes 50 seconds

This is a rehearsal plan, not a record of completed real transactions. Prerequisites: working AI key, eligible Sandbox merchant, separate buyer sessions, public HTTPS Node deployment, working v6 checkout and verified webhooks. Prepare authenticated Sandbox sessions in advance.

**0:00–0:15 — The table**
“One bill, three diners. AquilaTab lets everyone pay their exact item-level share directly to the restaurant.” Show The Olive Room and its table QR.

**0:15–0:45 — Read and review**
Upload a genuine USD receipt and wait for real extraction. Correct any ambiguous price or quantity and confirm uncertainty flags. Verify printed subtotal, charges and total. For rehearsal using the fictional sample bill, $125.00 subtotal + $12.50 tax + $6.25 service = $143.75. Do not describe synthetic data as a real receipt or claim inference happened when it did not.

**0:45–1:10 — Ask for the split**
“John has the burgers, Mary has the pizza, Alex has the rigatoni. Share burrata, fries and lemonade equally. Divide tax and service equally.” Wait for the actual model response. Show shared assignments and exact integer-cent calculations. For this included sample and diner order: **John $56.60, Mary $44.58, Alex $42.57**, totaling **$143.75**. Other receipts have different totals.

**1:10–1:25 — Review and invite**
Confirm the reviewed allocation and open John's unique invitation in a separate buyer browser. He checks his items and approves his share before any PayPal order is created.

**1:25–1:55 — A real test payment**
Click the SDK v6 PayPal checkout button, authorize as a Sandbox buyer, and wait for server capture plus canonical verification. Show the actual capture ID. The dashboard must now show **$56.60 verified and $87.15 outstanding**, with Mary/Alex unpaid. Reopen John's link: no further checkout is offered.

**1:55–2:10 — An unfinished checkout**
Approve Mary's share and cancel her PayPal checkout. No capture means no payment. If a real decline is not reproducible, state that denial behavior is covered by mocked contract tests rather than staging a fake result.

**2:10–2:40 — Settle**
Complete Mary's and Alex's genuine Sandbox payments. Show every diner verified, $143.75 collected, $0 outstanding and table closed. Never substitute manual database edits or invented transaction IDs. Allow provider latency; shorten the introduction rather than faking results.

**2:40–2:50 — Why it matters**
“AI interprets who had what. People approve their shares. PayPal processes independent merchant payments, and verified events reconcile the table.”
