import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:net";
import assert from "node:assert/strict";

const directory = await mkdtemp(join(tmpdir(), "aquila-browser-"));
const output = resolve(process.env.QA_OUTPUT_DIR || ".qa-artifacts");
await mkdir(output, { recursive: true });
const port = await new Promise((resolvePort, reject) => {
  const listener = createServer();
  listener.on("error", reject);
  listener.listen(0, "127.0.0.1", () => {
    const number = listener.address().port;
    listener.close(() => resolvePort(number));
  });
});
const origin = `http://127.0.0.1:${port}`;
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
      DB_PATH: join(directory, "qa.sqlite"),
      OPENAI_API_KEY: "",
      AI_PROVIDER: "manual",
      ALLOW_PAID_AI: "false",
      GEMINI_API_KEY: "",
      GEMINI_FREE_TIER_CONFIRMED: "false",
      PAYPAL_CLIENT_ID: "",
      PAYPAL_CLIENT_SECRET: "",
      PAYPAL_MERCHANT_ID: "",
      PAYPAL_WEBHOOK_ID: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let logs = "",
  browser;
for (const stream of [server.stdout, server.stderr])
  stream.on("data", (chunk) => (logs += chunk));
const checks = [],
  errors = [];
const cents = (text) => {
  const [whole, part] = text.replace("$", "").split(".");
  return Number(whole) * 100 + Number(part);
};
async function layout(page, label) {
  const dimensions = await page.evaluate(() => ({
    width: innerWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  assert.ok(
    dimensions.scroll <= dimensions.width + 1,
    `${label} horizontal overflow: ${JSON.stringify(dimensions)}`,
  );
  checks.push(label + ": no horizontal overflow");
}
async function view(page, name) {
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name, exact: true })
    .click();
}
async function screenshot(page, name) {
  await page.screenshot({ path: join(output, name + ".png"), fullPage: false });
}
try {
  let available = false;
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null)
      throw new Error("Production server exited: " + logs);
    try {
      if ((await fetch(origin)).ok) {
        available = true;
        break;
      }
    } catch {}
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  assert.ok(available, "Production server did not become ready: " + logs);
  const executable =
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
    (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
  browser = await chromium.launch({
    executablePath: executable,
    headless: true,
    args: ["--disable-dev-shm-usage"],
  });
  for (const viewport of [
    { name: "desktop", width: 1440, height: 1000 },
    { name: "mobile", width: 390, height: 844 },
    { name: "narrow-mobile", width: 360, height: 800 },
  ]) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      isMobile: viewport.width < 600,
      hasTouch: viewport.width < 600,
    });
    const page = await context.newPage();
    page.on("pageerror", (error) =>
      errors.push(`${viewport.name}: ${error.message}`),
    );
    await page.goto(origin);
    await page.getByRole("heading", { name: "Table 7", exact: true }).waitFor();
    await layout(page, viewport.name + " dashboard");
    assert.equal(
      await page
        .getByRole("button", { name: "Scan a receipt", exact: true })
        .count(),
      1,
      "Scan action needs an accessible name at " + viewport.name,
    );
    await screenshot(page, viewport.name + "-overview");
    await page
      .getByRole("button", { name: "Table QR code", exact: true })
      .click();
    const modal = page.getByRole("dialog");
    await modal.waitFor();
    await page.getByRole("button", { name: "Close QR", exact: true }).focus();
    await page.keyboard.press("Shift+Tab");
    assert.equal(
      await page
        .getByRole("link", { name: "Open table page" })
        .evaluate((element) => document.activeElement === element),
      true,
    );
    await page.keyboard.press("Tab");
    assert.equal(
      await page
        .getByRole("button", { name: "Close QR" })
        .evaluate((element) => document.activeElement === element),
      true,
    );
    const tablePath = await modal
      .getByRole("link", { name: "Open table page" })
      .getAttribute("href");
    await page.keyboard.press("Escape");
    assert.equal(await modal.count(), 0);
    checks.push(viewport.name + ": QR destination and keyboard focus trap");

    await view(page, "Receipt scanner");
    await page
      .getByRole("heading", { name: "Receipt details", exact: true })
      .waitFor();
    const line = page.getByRole("textbox", {
      name: "Wagyu smash burger line amount",
      exact: true,
    });
    await line.fill("35.00");
    await line.press("Tab");
    await page.getByText(/Unit price × quantity differs/).waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: "Confirm split & create links" })
        .isDisabled(),
      true,
    );
    await line.fill("36.00");
    await line.press("Tab");
    await layout(page, viewport.name + " receipt editor");
    checks.push(
      viewport.name +
        ": inconsistent receipt blocks confirmation; manual correction restores it",
    );
    const pixel = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=",
      "base64",
    );
    await page.getByLabel("Receipt image", { exact: true }).setInputFiles({
      name: "synthetic-pixel.png",
      mimeType: "image/png",
      buffer: pixel,
    });
    await page
      .getByRole("alert")
      .filter({ hasText: "AI is in manual mode" })
      .waitFor();
    await page.getByRole("button", { name: "Dismiss error" }).click();
    checks.push(
      viewport.name +
        ": real upload request reports missing AI credentials without inventing extraction",
    );

    await view(page, "Split workspace");
    await page.getByRole("textbox", { name: "New diner name" }).fill("Taylor");
    await page.getByRole("button", { name: "Add diner", exact: true }).click();
    assert.equal(await page.locator(".diner-row").count(), 4);
    await page
      .getByRole("button", { name: "Remove Taylor", exact: true })
      .click();
    assert.equal(await page.locator(".diner-row").count(), 3);
    await page
      .getByRole("button", { name: "Split equally", exact: true })
      .click();
    let amounts = (
      await page.locator(".diner-row > strong").allTextContents()
    ).map(cents);
    assert.equal(
      amounts.reduce((sum, amount) => sum + amount, 0),
      14375,
    );
    assert.ok(Math.max(...amounts) - Math.min(...amounts) <= 1);
    await page.getByRole("button", { name: "By item", exact: true }).click();
    amounts = (await page.locator(".diner-row > strong").allTextContents()).map(
      cents,
    );
    assert.deepEqual(amounts, [5660, 4458, 4257]);
    await page
      .getByRole("button", {
        name: "House lemonade assigned to John",
        exact: true,
      })
      .click();
    assert.equal(
      await page
        .getByRole("button", {
          name: "House lemonade assigned to John",
          exact: true,
        })
        .getAttribute("aria-pressed"),
      "false",
    );
    await page
      .getByRole("button", {
        name: "House lemonade assigned to John",
        exact: true,
      })
      .click();
    await page
      .getByRole("combobox", { name: "Charge distribution" })
      .selectOption("proportional");
    assert.equal(
      (await page.locator(".diner-row > strong").allTextContents())
        .map(cents)
        .reduce((sum, amount) => sum + amount, 0),
      14375,
    );
    await page
      .getByRole("combobox", { name: "Charge distribution" })
      .selectOption("equal");
    await layout(page, viewport.name + " split editor");
    checks.push(
      viewport.name +
        ": diner management, shared items, equal/itemized splits and proportional charges",
    );
    await page
      .getByRole("button", { name: "Apply split", exact: true })
      .click();
    await page
      .getByRole("alert")
      .filter({ hasText: "AI is in manual mode" })
      .waitFor();
    await page.getByRole("button", { name: "Dismiss error" }).click();
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
    assert.equal(await page.locator(".payment-row").count(), 3);
    await layout(page, viewport.name + " payment tracking");
    const invitation = await page
      .getByRole("link", { name: "Open link", exact: true })
      .first()
      .getAttribute("href");
    await screenshot(page, viewport.name + "-payments");
    checks.push(
      viewport.name +
        ": confirmed locked amounts and three independent invitations",
    );

    const diner = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      isMobile: viewport.width < 600,
      hasTouch: viewport.width < 600,
    });
    const guest = await diner.newPage();
    guest.on("pageerror", (error) =>
      errors.push(`${viewport.name} guest: ${error.message}`),
    );
    await guest.goto(origin + invitation);
    await guest
      .getByRole("heading", { name: "Your share, John.", exact: true })
      .waitFor();
    assert.equal(
      await guest
        .getByRole("button", { name: "Approve my share" })
        .isDisabled(),
      true,
    );
    await guest.getByRole("checkbox").check();
    await guest.getByRole("button", { name: "Approve my share" }).click();
    await guest.getByText("Connect PayPal Sandbox to continue.").waitFor();
    assert.equal(
      await guest.getByRole("button", { name: "Pay with PayPal" }).count(),
      0,
    );
    await layout(guest, viewport.name + " independent diner page");
    await screenshot(guest, viewport.name + "-diner");
    await guest.reload();
    await guest.getByText("Connect PayPal Sandbox to continue.").waitFor();
    checks.push(
      viewport.name +
        ": separate diner session, explicit review, persistent approval and truthful PayPal setup state",
    );
    await guest.goto(origin + tablePath);
    await guest
      .getByRole("heading", { name: "Welcome to the table.", exact: true })
      .waitFor();
    assert.equal(await guest.locator(".table-diner").count(), 3);
    await layout(guest, viewport.name + " table QR page");
    await guest.goto(origin + "/pay/invalid");
    await guest
      .getByRole("alert")
      .filter({ hasText: "Invalid invitation" })
      .waitFor();
    await diner.close();

    await view(page, "Activity");
    await page
      .getByText("Reviewed split locked; independent invitations created", {
        exact: true,
      })
      .waitFor();
    await page
      .getByRole("button", { name: "Integration status", exact: true })
      .click();
    await page
      .getByRole("heading", {
        name: "The foundations of a fair split.",
        exact: true,
      })
      .waitFor();
    await layout(page, viewport.name + " integrations");
    await page
      .getByRole("button", { name: "Open a new sample table", exact: true })
      .click();
    await page.getByRole("heading", { name: "Table 8", exact: true }).waitFor();
    const selector = page.getByRole("combobox", {
      name: "Choose table",
      exact: true,
    });
    const options = await selector.locator("option").allTextContents();
    assert.deepEqual(options, ["Table 8", "Table 7"]);
    checks.push(
      viewport.name +
        ": activity, integration navigation and new-table creation",
    );
    await context.close();
  }
  assert.deepEqual(errors, [], "Browser exceptions");
  const result = {
    status: "passed",
    browser: browser.version(),
    viewports: [
      "1440x1000 desktop",
      "390x844 emulated mobile",
      "360x800 emulated mobile",
    ],
    checks,
    pageErrors: errors,
    providerCalls:
      "No live provider credentials; no payment or inference success claimed",
  };
  await writeFile(join(output, "report.json"), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser?.close();
  if (server.exitCode === null) {
    const ended = new Promise((resolveEnd) => server.once("exit", resolveEnd));
    server.kill("SIGTERM");
    await ended;
  }
  await rm(directory, { recursive: true, force: true });
}
