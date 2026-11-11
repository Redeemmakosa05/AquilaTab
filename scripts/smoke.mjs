import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import assert from "node:assert/strict";
const directory = await mkdtemp(join(tmpdir(), "aquila-http-"));
const port = await new Promise((resolve, reject) => {
  const listener = createServer();
  listener.on("error", reject);
  listener.listen(0, "127.0.0.1", () => {
    const number = listener.address().port;
    listener.close(() => resolve(number));
  });
});
const origin = "http://127.0.0.1:" + port,
  checks = [];
let server,
  logs = "";
async function start() {
  server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    {
      env: {
        ...process.env,
        NODE_ENV: "production",
        NEXT_TELEMETRY_DISABLED: "1",
        APP_URL: origin,
        DB_PATH: join(directory, "data.sqlite"),
        OPENAI_API_KEY: "",
        PAYPAL_CLIENT_ID: "",
        PAYPAL_CLIENT_SECRET: "",
        PAYPAL_MERCHANT_ID: "",
        PAYPAL_WEBHOOK_ID: "",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  for (const stream of [server.stdout, server.stderr])
    stream.on("data", (chunk) => (logs += chunk.toString()));
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error("Next failed: " + logs);
    try {
      if ((await fetch(origin)).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Next failed to become ready: " + logs);
}
async function stop() {
  if (!server || server.exitCode !== null) return;
  const exited = new Promise((resolve) => server.once("exit", resolve));
  server.kill("SIGTERM");
  await exited;
}
async function api(path, body, cookie) {
  const response = await fetch(origin + "/api/" + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return {
    status: response.status,
    headers: response.headers,
    body: await response.json(),
  };
}
try {
  await start();
  const html = await (await fetch(origin)).text();
  assert.ok(html.includes("Good food. Fair shares."));
  const assets = [
    ...html.matchAll(/(?:src|href)="([^\"]+\.(?:js|css)(?:\?[^\"]*)?)"/g),
  ]
    .map((match) => match[1])
    .filter((url) => url.startsWith("/_next/"));
  assert.ok(assets.length);
  for (const asset of assets)
    assert.equal(
      (await fetch(origin + asset.replaceAll("&amp;", "&"))).status,
      200,
    );
  checks.push("Production HTML, JavaScript and CSS serve successfully");
  const dashboard = await api("dashboard");
  assert.equal(dashboard.status, 200);
  const cookie = dashboard.headers.get("set-cookie");
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /Secure/i);
  const session = cookie.split(";")[0],
    bill = dashboard.body.bills[0];
  assert.equal(
    (await api(`tables/${bill.id}/save`, { version: 1, data: bill.data }))
      .status,
    401,
  );
  checks.push(
    "Actual secure HTTP-only merchant cookie and unauthorized-write protection",
  );
  const confirmed = await api(
    `tables/${bill.id}/finalize`,
    { version: 1, approved: true },
    session,
  );
  assert.equal(confirmed.status, 200);
  assert.equal(confirmed.body.shares.length, 3);
  assert.equal(
    confirmed.body.shares.reduce((sum, s) => sum + s.amount, 0),
    14375,
  );
  checks.push(
    "Atomic HTTP finalization and three exact-sum independent invitations",
  );
  const token = confirmed.body.shares[0].token;
  assert.equal((await api("pay/" + token)).body.amount, 5660);
  assert.equal((await api("pay/" + token + "/review", {})).status, 200);
  assert.equal((await api("pay/" + token + "/order", {})).status, 503);
  assert.equal((await api("pay/" + token)).body.verified, false);
  assert.equal((await api("tables/" + bill.id)).body.paid, 0);
  checks.push("Independent diner review and honest missing-provider states");
  await stop();
  await start();
  const restored = await api("dashboard", undefined, session);
  assert.equal(restored.body.bills[0].id, bill.id);
  assert.equal(restored.body.bills[0].locked, true);
  assert.equal(restored.body.bills[0].shares.length, 3);
  assert.equal((await api("pay/" + token)).body.reviewed, true);
  checks.push(
    "Merchant sessions, bills, invitation signatures and review survive a full restart",
  );
  console.log(
    JSON.stringify(
      { status: "passed", checks, realProviderCalls: false, browserQA: false },
      null,
      2,
    ),
  );
} finally {
  await stop();
  await rm(directory, { recursive: true, force: true });
}
