import { z } from "zod";
import { billSchema, calculate, Fault } from "@/lib/core";
import {
  bill,
  db,
  event,
  hash,
  invitation,
  invitationToken,
  owned,
  rateLimit,
  seed,
  shares,
  snapshot,
  transaction,
  uid,
  type BillRow,
} from "@/lib/db";
import {
  checkoutConfig,
  cancelOrder,
  captureOrder,
  createOrder,
  paypal,
  paypalReady,
  reconcile,
  webhook,
} from "@/lib/paypal";
import { extract, interpret } from "@/lib/ai";
import { json, merchant, reply, sameOrigin } from "@/lib/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handle(req: Request, path: string[]) {
  const [kind, id, action] = path,
    method = req.method;
  if (kind === "webhooks" && id === "paypal" && method === "POST")
    return reply(await webhook(req, await json(req, 1000000)));
  if (method === "POST") sameOrigin(req);
  if (kind === "dashboard" && method === "GET") {
    const owner = await merchant(true);
    const rows = db()
      .prepare("SELECT * FROM bills WHERE owner=? ORDER BY created DESC")
      .all(owner) as BillRow[];
    return reply({
      bills: rows.map(snapshot),
      config: {
        ai: !!process.env.OPENAI_API_KEY,
        paypal: paypalReady(),
        webhook: !!process.env.PAYPAL_WEBHOOK_ID,
      },
    });
  }
  if (kind === "receipt" && method === "POST") {
    const owner = await merchant();
    rateLimit(owner + ":ai", 6);
    if (Number(req.headers.get("content-length") ?? 0) > 9 * 1024 * 1024)
      throw new Fault(413, "Upload too large");
    const raw = await req.arrayBuffer();
    if (raw.byteLength > 9 * 1024 * 1024)
      throw new Fault(413, "Upload too large");
    const form = await new Response(raw, {
      headers: { "Content-Type": req.headers.get("content-type") ?? "" },
    }).formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new Fault(422, "Choose a receipt image");
    return reply({ receipt: await extract(file) });
  }
  if (kind === "tables" && !id && method === "POST") {
    const owner = await merchant();
    rateLimit(owner + ":new", 5);
    return reply({ id: seed(owner) }, 201);
  }
  if (kind === "tables" && id && method === "GET") {
    const row = bill(id),
      view = snapshot(row);
    return reply({
      id,
      number: row.number,
      receipt: view.data.receipt,
      paid: view.paid,
      outstanding: view.outstanding,
      closed: view.closed,
      diners: view.shares.map((s) => ({
        name: s.name,
        amount: s.amount,
        state: s.state,
        verified: s.verified,
      })),
    });
  }
  if (kind === "tables" && id && method === "POST") {
    const owner = await merchant();
    rateLimit(owner + ":write");
    const row = owned(id, owner);
    if (action === "reconcile") {
      rateLimit(owner + ":reconcile", 6);
      for (const share of shares(id)) {
        if (
          share.order_id &&
          !share.verified &&
          !["REFUNDED", "REVERSED"].includes(share.state)
        )
          reconcile(
            await paypal(
              "/v2/checkout/orders/" + encodeURIComponent(share.order_id),
            ),
            share,
          );
      }
      return reply(snapshot(bill(id)));
    }
    if (action === "ai") {
      if (row.locked) throw new Fault(409, "Confirmed bill is locked");
      rateLimit(owner + ":ai", 6);
      const body = z
        .object({ instruction: z.string().trim().min(3).max(2000) })
        .parse(await json(req));
      const data = billSchema.parse(JSON.parse(row.data));
      const proposed = await interpret(body.instruction, data);
      calculate({ ...data, ...proposed, mode: "items" });
      return reply({ ...proposed, version: row.version });
    }
    if (action === "save") {
      if (row.locked)
        throw new Fault(409, "Confirmed payment amounts are locked");
      const body = z
        .object({ version: z.number().int(), data: billSchema })
        .parse(await json(req));
      const result = db()
        .prepare(
          "UPDATE bills SET data=?,version=version+1 WHERE id=? AND owner=? AND version=? AND locked=0",
        )
        .run(JSON.stringify(body.data), id, owner, body.version);
      if (!result.changes)
        throw new Fault(
          409,
          "This bill changed in another window. Reload before editing.",
        );
      event(id, "BILL_UPDATED", "Receipt and allocations saved");
      return reply(snapshot(bill(id)));
    }
    if (action === "finalize") {
      const body = z
        .object({ version: z.number().int(), approved: z.literal(true) })
        .parse(await json(req));
      return reply(
        transaction(() => {
          const current = owned(id, owner);
          if (current.locked || current.version !== body.version)
            throw new Fault(409, "Bill changed or already confirmed");
          const allocations = calculate(JSON.parse(current.data)),
            expires = Date.now() + 4 * 3600000;
          for (const share of allocations) {
            const sid = uid(),
              token = invitationToken(sid, expires);
            db()
              .prepare(
                "INSERT INTO shares(id,bill,name,amount,detail,token_hash,expires,updated) VALUES(?,?,?,?,?,?,?,?)",
              )
              .run(
                sid,
                id,
                share.name,
                share.total,
                JSON.stringify(share),
                hash(token),
                expires,
                Date.now(),
              );
          }
          db()
            .prepare("UPDATE bills SET locked=1,version=version+1 WHERE id=?")
            .run(id);
          event(
            id,
            "SPLIT_CONFIRMED",
            "Reviewed split locked; independent invitations created",
          );
          return snapshot(bill(id));
        }),
      );
    }
  }
  if (kind === "pay" && id) {
    const share = invitation(id),
      row = bill(share.bill),
      view = snapshot(row);
    if (method === "GET")
      return reply({
        name: share.name,
        amount: share.amount,
        detail: JSON.parse(share.detail),
        reviewed: !!share.reviewed,
        verified: !!share.verified,
        state: share.state,
        restaurant: view.data.receipt.restaurant,
        table: row.number,
        bill: row.id,
        paid: view.paid,
        total: view.data.receipt.total,
        outstanding: view.outstanding,
        closed: view.closed,
        captureId: share.capture_id,
        paypalReady: paypalReady(),
      });
    if (method === "POST" && action !== "review") {
      rateLimit(share.id + ":payment", 20);
      if (action === "cancel") return reply(await cancelOrder(share));
      if (!share.reviewed)
        throw new Fault(409, "Review your share before checkout");
      if (action === "sdk") return reply(checkoutConfig());
      if (action === "order") return reply(await createOrder(share));
      if (action === "capture") {
        const body = z
          .object({ orderId: z.string().min(1).max(100) })
          .parse(await json(req));
        if (body.orderId !== share.order_id)
          throw new Fault(409, "Order does not belong to this invitation");
        return reply(await captureOrder(share));
      }
    }
    if (method === "POST" && action === "review") {
      rateLimit(share.id + ":review");
      db()
        .prepare("UPDATE shares SET reviewed=1,updated=? WHERE id=?")
        .run(Date.now(), share.id);
      return reply({ reviewed: true });
    }
  }
  throw new Fault(404, "Endpoint not found");
}
async function route(
  req: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    return await handle(req, (await context.params).path);
  } catch (error) {
    if (error instanceof Fault)
      return reply({ error: error.message }, error.status);
    if (error instanceof z.ZodError)
      return reply(
        {
          error: "Check the receipt and input fields",
          fields: error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        },
        422,
      );
    console.error(
      "Request failed",
      error instanceof Error ? error.name : "unknown",
    );
    return reply(
      { error: "Request could not be completed. Retry safely." },
      500,
    );
  }
}
export const GET = route;
export const POST = route;
