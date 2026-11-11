import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:net";
import assert from "node:assert/strict";

const directory = await mkdtemp(join(tmpdir(), "aquila-rehearsal-"));
const output = resolve(
  process.env.DEMO_OUTPUT_DIR || ".qa-artifacts/rehearsal",
);
await mkdir(output, { recursive: true });
const port = await new Promise((resolvePort) => {
  const listener = createServer();
  listener.listen(0, "127.0.0.1", () => {
    const port = listener.address().port;
    listener.close(() => resolvePort(port));
  });
});
const origin = "http://127.0.0.1:" + port;
const server = spawn(
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
      DB_PATH: join(directory, "demo.sqlite"),
      AI_PROVIDER: "manual",
      GEMINI_API_KEY: "",
      GEMINI_FREE_TIER_CONFIRMED: "false",
      ALLOW_PAID_AI: "false",
      OPENAI_API_KEY: "",
      PAYPAL_CLIENT_ID: "",
      PAYPAL_CLIENT_SECRET: "",
      PAYPAL_MERCHANT_ID: "",
      PAYPAL_WEBHOOK_ID: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let browser,
  context,
  log = "";
server.stderr.on("data", (chunk) => (log += chunk));
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(origin + "/api/health")).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  assert.ok(ready, log);
  browser = await chromium.launch({
    executablePath:
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
      (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
    headless: true,
  });
  context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir: output, size: { width: 1280, height: 800 } },
  });
  await context.addInitScript(() =>
    document.addEventListener("DOMContentLoaded", () => {
      const banner = document.createElement("div");
      banner.id = "rehearsal-caption";
      Object.assign(banner.style, {
        position: "fixed",
        bottom: "12px",
        left: "20px",
        right: "20px",
        zIndex: "999999",
        padding: "13px 18px",
        background: "#101e35f2",
        color: "white",
        borderRadius: "9px",
        font: "14px Arial",
        lineHeight: "1.8",
        pointerEvents: "none",
      });
      banner.textContent =
        "MANUAL REHEARSAL — No AI inference or PayPal transaction performed";
      document.body.append(banner);
    }),
  );
  const page = await context.newPage();
  const video = page.video();
  async function caption(text, seconds = 6) {
    await page.evaluate((text) => {
      document.getElementById("rehearsal-caption").textContent =
        "MANUAL REHEARSAL — No AI inference or PayPal transaction performed | " +
        text;
    }, text);
    await page.waitForTimeout(seconds * 1000);
  }
  async function view(name) {
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("button", { name, exact: true })
      .click();
  }
  await page.goto(origin);
  await page.getByRole("heading", { name: "Table 7", exact: true }).waitFor();
  await caption(
    "AquilaTab: Scan. Split. Settle. A real local app with a fictional, unpaid restaurant bill.",
    7,
  );
  await view("Receipt scanner");
  await page
    .getByRole("heading", { name: "Receipt details", exact: true })
    .waitFor();
  const amount = page.getByRole("textbox", {
    name: "Wagyu smash burger line amount",
    exact: true,
  });
  await amount.fill("35.00");
  await amount.press("Tab");
  await caption(
    "An inconsistent line amount blocks confirmation. Every cent is validated by deterministic code.",
    6,
  );
  await amount.fill("36.00");
  await amount.press("Tab");
  await view("Split workspace");
  await caption(
    "John: $56.60. Mary: $44.58. Alex: $42.57. Shared food and charges reconcile to $143.75.",
    7,
  );
  await page
    .getByRole("button", { name: "Split equally", exact: true })
    .click();
  await caption(
    "Equal splitting preserves every cent. Item-level assignments remain available.",
    5,
  );
  await page.getByRole("button", { name: "By item", exact: true }).click();
  await page.getByRole("button", { name: "Apply split", exact: true }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "AI is in manual mode" })
    .waitFor();
  await caption(
    "Gemini Free Tier awaits a billing-disabled project key. No generated receipt or AI answer is fabricated.",
    7,
  );
  await page.getByRole("button", { name: "Dismiss error" }).click();
  await page
    .getByRole("button", { name: "Table QR code", exact: true })
    .click();
  await caption(
    "A table QR opens the correct bill. Private diner invitations are shared separately.",
    5,
  );
  await page.keyboard.press("Escape");
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Confirm split & create links" })
    .click();
  await page
    .getByRole("heading", {
      name: "One table. Independent payments.",
      exact: true,
    })
    .waitFor();
  await caption(
    "Reviewed amounts are locked. Three independent, signed payment invitations are created.",
    7,
  );
  const invitation = await page
    .getByRole("link", { name: "Open link", exact: true })
    .first()
    .getAttribute("href");
  await page.goto(origin + invitation);
  await page
    .getByRole("heading", { name: "Your share, John.", exact: true })
    .waitFor();
  await caption(
    "The diner reviews their fixed share and approves it before any payment can start.",
    6,
  );
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Approve my share" }).click();
  await page.getByText("Connect PayPal Sandbox to continue.").waitFor();
  await caption(
    "PayPal Sandbox credentials are not configured. No checkout success or capture is claimed.",
    8,
  );
  await caption(
    "Source, 60 automated tests, browser QA and judge-run setup are on GitHub. Live AI/payment video remains pending.",
    6,
  );
  await context.close();
  context = null;
  const final = join(output, "manual-rehearsal.webm");
  await video.saveAs(final);
  console.log(
    JSON.stringify({
      file: final,
      kind: "manual-workflow rehearsal only",
      realAI: false,
      realPayPal: false,
      publicYouTubeUpload: false,
    }),
  );
} finally {
  await context?.close();
  await browser?.close();
  if (server.exitCode === null) {
    const exited = new Promise((resolveExit) =>
      server.once("exit", resolveExit),
    );
    server.kill("SIGTERM");
    await exited;
  }
  await rm(directory, { recursive: true, force: true });
}
