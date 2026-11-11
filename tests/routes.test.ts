import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const session = vi.hoisted(() => ({ token: "" }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (session.token ? { value: session.token } : undefined),
    set: (_key: string, value: string) => {
      session.token = value;
    },
  }),
}));
import { GET, POST } from "../app/api/[...path]/route";
import { db, shares } from "../lib/db";
import type { BillData } from "../lib/core";
let id: string, data: BillData, merchantCookie: string;
async function request(
  path: string,
  body?: unknown,
  origin = "http://localhost",
) {
  const method = body === undefined ? "GET" : "POST";
  const req = new Request("http://localhost/api/" + path, {
    method,
    headers: { Origin: origin, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const response = await (method === "GET" ? GET : POST)(req, {
    params: Promise.resolve({ path: path.split("/") }),
  });
  return { status: response.status, body: await response.json() };
}
beforeAll(() => {
  process.env.DB_PATH = join(
    mkdtempSync(join(tmpdir(), "aquila-routes-")),
    "test.sqlite",
  );
  for (const key of [
    "APP_URL",
    "OPENAI_API_KEY",
    "AI_PROVIDER",
    "ALLOW_PAID_AI",
    "GEMINI_API_KEY",
    "GEMINI_FREE_TIER_CONFIRMED",
    "PAYPAL_CLIENT_ID",
    "PAYPAL_CLIENT_SECRET",
    "PAYPAL_MERCHANT_ID",
    "PAYPAL_WEBHOOK_ID",
  ])
    delete process.env[key];
});
beforeEach(async () => {
  session.token = "";
  const result = await request("dashboard");
  id = result.body.bills[0].id;
  data = result.body.bills[0].data;
  merchantCookie = session.token;
});
describe("merchant and diner routes", () => {
  it("checks SQLite readiness without creating a merchant session or exposing configuration", async () => {
    session.token = "";
    const result = await request("health");
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ status: "ok" });
    expect(session.token).toBe("");
  });
  it("creates and reuses a persistent merchant workspace", async () => {
    const result = await request("dashboard");
    expect(result.status).toBe(200);
    expect(result.body.bills).toHaveLength(1);
    expect(result.body.bills[0].id).toBe(id);
    expect(result.body.config).toMatchObject({ ai: false, paypal: false });
  });
  it("rejects missing sessions and another merchant", async () => {
    session.token = "";
    expect(
      (await request(`tables/${id}/save`, { version: 1, data })).status,
    ).toBe(401);
    await request("dashboard");
    expect(
      (await request(`tables/${id}/save`, { version: 1, data })).status,
    ).toBe(403);
    session.token = merchantCookie;
  });
  it("rejects cross-origin mutations", async () =>
    expect(
      (
        await request(
          `tables/${id}/save`,
          { version: 1, data },
          "https://attacker.test",
        )
      ).status,
    ).toBe(403));
  it("persists corrections and rejects stale versions", async () => {
    data.receipt.items[0].name = "Corrected burger";
    const result = await request(`tables/${id}/save`, { version: 1, data });
    expect(result.status).toBe(200);
    expect(result.body.version).toBe(2);
    expect(
      (await request(`tables/${id}/save`, { version: 1, data })).status,
    ).toBe(409);
    expect(
      (await request("dashboard")).body.bills[0].data.receipt.items[0].name,
    ).toBe("Corrected burger");
  });
  it("requires review and refuses uncertain receipt finalization", async () => {
    expect(
      (await request(`tables/${id}/finalize`, { version: 1, approved: false }))
        .status,
    ).toBe(422);
    data.receipt.items[0].uncertain = true;
    await request(`tables/${id}/save`, { version: 1, data });
    expect(
      (await request(`tables/${id}/finalize`, { version: 2, approved: true }))
        .status,
    ).toBe(422);
    expect(shares(id)).toHaveLength(0);
  });
  it("atomically creates unique signed links and locks all amounts", async () => {
    const result = await request(`tables/${id}/finalize`, {
      version: 1,
      approved: true,
    });
    expect(result.status).toBe(200);
    expect(result.body.shares).toHaveLength(3);
    expect(
      new Set(result.body.shares.map((s: { token: string }) => s.token)).size,
    ).toBe(3);
    expect(
      result.body.shares.reduce(
        (sum: number, s: { amount: number }) => sum + s.amount,
        0,
      ),
    ).toBe(14375);
    expect(
      (await request(`tables/${id}/finalize`, { version: 1, approved: true }))
        .status,
    ).toBe(409);
    expect(
      (await request(`tables/${id}/save`, { version: 2, data })).status,
    ).toBe(409);
  });
  it("supports independent diner sessions without revealing other invitations", async () => {
    const result = await request(`tables/${id}/finalize`, {
      version: 1,
      approved: true,
    });
    session.token = "";
    const token = result.body.shares[0].token,
      payment = await request("pay/" + token);
    expect(payment.body.name).toBe("John");
    expect(payment.body).not.toHaveProperty("shares");
    expect(payment.body.reviewed).toBe(false);
    expect((await request("pay/" + token + "/review", {})).status).toBe(200);
    expect((await request("pay/" + token)).body.reviewed).toBe(true);
  });
  it("requires diner review and refuses missing provider configuration", async () => {
    const result = await request(`tables/${id}/finalize`, {
      version: 1,
      approved: true,
    });
    const token = result.body.shares[0].token;
    expect((await request("pay/" + token + "/order", {})).status).toBe(409);
    await request("pay/" + token + "/review", {});
    expect((await request("pay/" + token + "/order", {})).status).toBe(503);
    expect((await request("pay/" + token + "/sdk", {})).status).toBe(503);
    expect((await request("pay/" + token)).body).toMatchObject({
      verified: false,
      state: "PENDING",
    });
    expect((await request("dashboard")).body.bills[0].paid).toBe(0);
  });
  it("persists cancellation without claiming a payment", async () => {
    const result = await request(`tables/${id}/finalize`, {
      version: 1,
      approved: true,
    });
    const token = result.body.shares[0].token;
    await request("pay/" + token + "/cancel", {});
    expect((await request("pay/" + token)).body).toMatchObject({
      state: "CANCELLED",
      verified: false,
    });
  });
  it("rejects invalid invitations and client order substitution", async () => {
    expect((await request("pay/invalid")).status).toBe(401);
    const result = await request(`tables/${id}/finalize`, {
      version: 1,
      approved: true,
    });
    const token = result.body.shares[0].token;
    await request("pay/" + token + "/review", {});
    expect(
      (await request("pay/" + token + "/capture", { orderId: "ATTACKER" }))
        .status,
    ).toBe(409);
  });
  it("shows a public table while protecting merchant and invitation secrets", async () => {
    await request(`tables/${id}/finalize`, { version: 1, approved: true });
    session.token = "";
    const result = await request("tables/" + id);
    expect(result.status).toBe(200);
    expect(result.body.number).toBe(7);
    expect(result.body).not.toHaveProperty("owner");
    expect(JSON.stringify(result.body)).not.toContain("token");
  });
  it("reports unavailable AI and rejects disguised image uploads", async () => {
    expect(
      (await request(`tables/${id}/ai`, { instruction: "Split equally" }))
        .status,
    ).toBe(503);
    const form = new FormData();
    form.append(
      "file",
      new File(["pretend"], "image.png", { type: "image/png" }),
    );
    const req = new Request("http://localhost/api/receipt", {
      method: "POST",
      headers: { Origin: "http://localhost" },
      body: form,
    });
    const response = await POST(req, {
      params: Promise.resolve({ path: ["receipt"] }),
    });
    expect(response.status).toBe(422);
  });
  it("rejects webhook deliveries without configured authentication", async () => {
    expect(
      (
        await request("webhooks/paypal", {
          id: "fake",
          event_type: "PAYMENT.CAPTURE.COMPLETED",
        })
      ).status,
    ).toBe(503);
    expect(
      db().prepare("SELECT COUNT(*) AS n FROM webhooks").get(),
    ).toMatchObject({ n: 0 });
  });
});
