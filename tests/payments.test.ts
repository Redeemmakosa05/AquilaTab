import { beforeAll, beforeEach, describe, it, expect, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { calculate, decimal, sample } from "../lib/core";
import {
  bill,
  db,
  hash,
  invitation,
  invitationToken,
  owned,
  seed,
  shares,
  snapshot,
  uid,
  type ShareRow,
} from "../lib/db";
import {
  checkoutConfig,
  cancelOrder,
  captureOrder,
  createOrder,
  reconcile,
  verifyWebhook,
  webhook,
} from "../lib/paypal";
let share: ShareRow;
function order(status = "COMPLETED", amount = share.amount) {
  return {
    id: share.order_id,
    status,
    purchase_units: [
      {
        custom_id: share.id,
        invoice_id: `${share.bill}-${share.id}`,
        payee: { merchant_id: "MERCHANT" },
        amount: { currency_code: "USD", value: decimal(amount) },
        payments: {
          captures:
            status === "COMPLETED"
              ? [
                  {
                    id: "CAP-" + share.id,
                    status: "COMPLETED",
                    final_capture: true,
                    amount: { currency_code: "USD", value: decimal(amount) },
                  },
                ]
              : [],
        },
      },
    ],
  };
}
function mock(responses: unknown[]) {
  const fetcher = vi.fn(async () => Response.json(responses.shift() ?? {}));
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}
function signedRequest() {
  return new Request("http://localhost/api/webhooks/paypal", {
    method: "POST",
    headers: {
      "paypal-auth-algo": "SHA256withRSA",
      "paypal-cert-url": "https://api.sandbox.paypal.com/cert",
      "paypal-transmission-id": "123",
      "paypal-transmission-sig": "signature",
      "paypal-transmission-time": new Date().toISOString(),
    },
  });
}
beforeAll(() => {
  process.env.DB_PATH = join(
    mkdtempSync(join(tmpdir(), "aquila-payments-")),
    "test.sqlite",
  );
  process.env.PAYPAL_CLIENT_ID = "test-client";
  process.env.PAYPAL_CLIENT_SECRET = "test-secret";
  process.env.PAYPAL_MERCHANT_ID = "MERCHANT";
  process.env.PAYPAL_WEBHOOK_ID = "WEBHOOK";
});
beforeEach(() => {
  vi.unstubAllGlobals();
  const bid = seed("owner"),
    allocation = calculate(sample)[0],
    id = uid(),
    expires = Date.now() + 3600000;
  db()
    .prepare(
      "INSERT INTO shares(id,bill,name,amount,detail,token_hash,expires,order_id,updated) VALUES(?,?,?,?,?,?,?,?,?)",
    )
    .run(
      id,
      bid,
      allocation.name,
      allocation.total,
      JSON.stringify(allocation),
      hash(invitationToken(id, expires)),
      expires,
      "ORDER-" + id,
      Date.now(),
    );
  share = shares(bid)[0];
});
describe("PayPal Sandbox contracts, mocked only", () => {
  it("accepts signed links but rejects tampering, unknown and expired tokens", () => {
    const token = invitationToken(share.id, share.expires);
    expect(invitation(token).id).toBe(share.id);
    expect(() => invitation(token + "x")).toThrow("Invalid");
    expect(() => invitation("invalid")).toThrow();
    expect(() =>
      invitation(invitationToken("unknown", share.expires)),
    ).toThrow();
    const expired = Date.now() - 1000;
    db()
      .prepare("UPDATE shares SET expires=?,token_hash=? WHERE id=?")
      .run(expired, hash(invitationToken(share.id, expired)), share.id);
    expect(() => invitation(invitationToken(share.id, expired))).toThrow(
      "expired",
    );
  });
  it("enforces merchant ownership", () => {
    expect(() => owned(share.bill, "attacker")).toThrow("Merchant");
    expect(owned(share.bill, "owner").id).toBe(share.bill);
  });
  it("does not treat approval as a completed payment", () => {
    expect(reconcile(order("APPROVED"), share)).toBe(false);
    expect(snapshot(bill(share.bill)).paid).toBe(0);
    expect(snapshot(bill(share.bill)).closed).toBe(false);
  });
  it("rejects overpayment and underpayment", () => {
    for (const amount of [share.amount - 1, share.amount + 1])
      expect(() => reconcile(order("COMPLETED", amount), share)).toThrow(
        "mismatch",
      );
  });
  it("rejects wrong merchant, currency, diner or capture amount", () => {
    for (const key of ["merchant", "currency", "diner", "capture"]) {
      const value = order();
      if (key === "merchant")
        value.purchase_units[0].payee.merchant_id = "ATTACKER";
      if (key === "currency")
        value.purchase_units[0].amount.currency_code = "EUR";
      if (key === "diner") value.purchase_units[0].custom_id = "ATTACKER";
      if (key === "capture")
        value.purchase_units[0].payments.captures[0].amount.value = "1.00";
      expect(() => reconcile(value, share)).toThrow();
    }
  });
  it("records exact capture IDs and leaves other shares outstanding", () => {
    expect(reconcile(order(), share)).toBe(true);
    const view = snapshot(bill(share.bill));
    expect(view.paid).toBe(5660);
    expect(view.outstanding).toBe(8715);
    expect(view.closed).toBe(false);
    expect(shares(share.bill)[0].capture_id).toBe("CAP-" + share.id);
  });
  it("makes duplicate captures idempotent and rejects a second charge", async () => {
    reconcile(order(), share);
    reconcile(order(), share);
    expect(snapshot(bill(share.bill)).paid).toBe(5660);
    await expect(createOrder(shares(share.bill)[0])).rejects.toThrow(
      "already paid",
    );
    expect((await captureOrder(shares(share.bill)[0])).paid).toBe(true);
    expect(
      db()
        .prepare(
          "SELECT COUNT(*) AS n FROM events WHERE bill=? AND type='PAYMENT_VERIFIED'",
        )
        .get(share.bill),
    ).toMatchObject({ n: 1 });
  });
  it("closes a table only after all exact captures reconcile", () => {
    for (const allocation of calculate(sample).slice(1)) {
      const id = uid(),
        expires = Date.now() + 10000;
      db()
        .prepare(
          "INSERT INTO shares(id,bill,name,amount,detail,token_hash,expires,order_id,updated) VALUES(?,?,?,?,?,?,?,?,?)",
        )
        .run(
          id,
          share.bill,
          allocation.name,
          allocation.total,
          JSON.stringify(allocation),
          hash(invitationToken(id, expires)),
          expires,
          "ORDER-" + id,
          Date.now(),
        );
    }
    for (const next of shares(share.bill)) {
      share = next;
      reconcile(order(), next);
    }
    expect(snapshot(bill(share.bill))).toMatchObject({
      paid: 14375,
      outstanding: 0,
      closed: true,
    });
  });
  it("creates a merchant-bound order with server amount and stable idempotency", async () => {
    db().prepare("UPDATE shares SET order_id=NULL WHERE id=?").run(share.id);
    share = shares(share.bill)[0];
    const fetcher = mock([
      { access_token: "server-token" },
      { id: "NEW-ORDER" },
    ]);
    expect(await createOrder(share)).toEqual({ orderId: "NEW-ORDER" });
    const calls = fetcher.mock.calls as unknown as [string, RequestInit][];
    expect(calls[1][0]).toBe(
      "https://api-m.sandbox.paypal.com/v2/checkout/orders",
    );
    const body = JSON.parse(calls[1][1].body as string);
    expect(body.purchase_units[0].amount.value).toBe("56.60");
    expect(body.purchase_units[0].payee.merchant_id).toBe("MERCHANT");
    expect(
      (calls[1][1].headers as Record<string, string>)["PayPal-Request-Id"],
    ).toBe("aq-order-" + share.id);
  });
  it("captures approved orders and verifies with an independent GET", async () => {
    const fetcher = mock([
      { access_token: "t" },
      order("APPROVED"),
      { access_token: "t" },
      { status: "COMPLETED" },
      { access_token: "t" },
      order(),
    ]);
    expect((await captureOrder(share)).paid).toBe(true);
    const calls = fetcher.mock.calls as unknown as [string, RequestInit][];
    expect(calls[3][0]).toContain("/capture");
    expect(calls[5][1].method).toBe("GET");
    expect(snapshot(bill(share.bill)).paid).toBe(5660);
  });
  it("retains an unpaid state after provider failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 500 })),
    );
    await expect(captureOrder(share)).rejects.toThrow();
    expect(snapshot(bill(share.bill)).paid).toBe(0);
  });
  it("records cancellation without marking an uncaptured order paid", async () => {
    mock([{ access_token: "t" }, order("CREATED")]);
    await cancelOrder(share);
    expect(shares(share.bill)[0]).toMatchObject({
      state: "CANCELLED",
      verified: 0,
    });
    expect(snapshot(bill(share.bill)).paid).toBe(0);
  });
  it("exposes only the public client ID for standard v6 checkout", () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    expect(checkoutConfig()).toEqual({ clientId: "test-client" });
    expect(fetcher).not.toHaveBeenCalled();
    expect(JSON.stringify(checkoutConfig())).not.toContain("test-secret");
  });
  it("rejects missing or invalid webhook signatures", async () => {
    await expect(
      verifyWebhook(new Request("http://localhost"), {}),
    ).rejects.toThrow("Missing");
    mock([{ access_token: "t" }, { verification_status: "FAILURE" }]);
    await expect(verifyWebhook(signedRequest(), {})).rejects.toThrow("Invalid");
  });
  it("verifies webhook authentication and deduplicates repeated delivery", async () => {
    const body = {
      id: uid(),
      event_type: "PAYMENT.CAPTURE.COMPLETED",
      resource: {
        supplementary_data: { related_ids: { order_id: share.order_id } },
      },
    };
    mock([
      { access_token: "t" },
      { verification_status: "SUCCESS" },
      { access_token: "t" },
      order(),
      { access_token: "t" },
      { verification_status: "SUCCESS" },
    ]);
    expect(await webhook(signedRequest(), body)).toEqual({ received: true });
    expect(await webhook(signedRequest(), body)).toMatchObject({
      duplicate: true,
    });
    expect(snapshot(bill(share.bill)).paid).toBe(5660);
  });
  it("records a signature-authenticated denial as failed without settlement", async () => {
    mock([{ access_token: "t" }, { verification_status: "SUCCESS" }]);
    await webhook(signedRequest(), {
      id: uid(),
      event_type: "PAYMENT.CAPTURE.DENIED",
      resource: {
        supplementary_data: { related_ids: { order_id: share.order_id } },
      },
    });
    expect(shares(share.bill)[0].state).toBe("FAILED");
    expect(snapshot(bill(share.bill)).paid).toBe(0);
  });
  it("keeps an approved but uncaptured order unpaid after a cancel callback", async () => {
    mock([{ access_token: "t" }, order("APPROVED")]);
    expect(await cancelOrder(share)).toEqual({ approved: true });
    expect(shares(share.bill)[0].state).toBe("APPROVED");
    expect(snapshot(bill(share.bill)).paid).toBe(0);
  });
  it("reopens settlement after a signed refund and rejects capture replay", async () => {
    reconcile(order(), share);
    mock([{ access_token: "t" }, { verification_status: "SUCCESS" }]);
    await webhook(signedRequest(), {
      id: uid(),
      event_type: "PAYMENT.CAPTURE.REFUNDED",
      resource: {
        supplementary_data: { related_ids: { capture_id: "CAP-" + share.id } },
      },
    });
    expect(snapshot(bill(share.bill)).paid).toBe(0);
    expect(() => reconcile(order(), share)).toThrow("Reversed");
    expect(shares(share.bill)[0].state).toBe("REFUNDED");
  });
});
