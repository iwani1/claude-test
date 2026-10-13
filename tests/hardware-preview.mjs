const { chromium } = require("playwright-core");
const sparticuz = require("@sparticuz/chromium").default ?? require("@sparticuz/chromium");
const fs = require("fs");
const BASE = "http://127.0.0.1:3000";
const SHOTS = process.env.SHOT_DIR || "/tmp/pos-hardware-shots";
fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0;
const check = (cond, label) => { if (!cond) throw new Error("FAIL: " + label); pass++; console.log("PASS hardware-software: " + label); };

(async () => {
  process.env.LD_LIBRARY_PATH = "/tmp/al2023/lib:" + (process.env.LD_LIBRARY_PATH || "");
  const executablePath = await sparticuz.executablePath(); // extracts Chromium; needs lib deps (see @sparticuz/chromium docs)
  const browser = await chromium.launch({ executablePath, args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"], headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  await ctx.addInitScript(() => {
    window.__printCalled = 0;
    window.print = () => { window.__printCalled += 1; };
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(45000);
  page.on("pageerror", e => console.log("PAGEERROR:", e.message));
  page.on("dialog", async d => { console.log("DIALOG:", d.type(), d.message()); await d.dismiss(); });

  // --- 1. Terminal login (email/password) ---
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await page.getByText("Email & Password", { exact: true }).waitFor({ timeout: 120000 });
  await page.getByText("Email & Password", { exact: true }).click();
  await page.locator('input[placeholder*="lushviewhotel"]').or(page.locator('input[type="email"]')).first().fill(EMAIL);
  await page.locator('input[type="password"]:visible').first().fill(PASSWORD);
  await page.getByRole("button", { name: /Sign in to Terminal/i }).click();
  await page.getByText("Take Order (Till)").first().waitFor({ timeout: 60000 });
  check(true, "terminal login succeeds (email/password path)");

  // --- 2. Build an order and send the kitchen docket ---
  await page.getByText("Take Order (Till)").first().click();
  await page.getByText("Meal", { exact: true }).first().waitFor({ timeout: 60000 });
  await page.getByText("Meal", { exact: true }).first().click();
  await page.getByRole("button", { name: /Kitchen Docket/i }).first().click();
  await page.getByText(/Kitchen Docket — Print & Deliver|Print Kitchen Docket/).first().waitFor({ timeout: 60000 });
  await page.screenshot({ path: SHOTS + "/1-kitchen-docket.png" });
  check(true, "order sent to kitchen and docket modal opened");

  const docketBody = await page.locator("body").innerText();
  check(/Lush View Hotel/.test(docketBody), "kitchen docket carries Lush View Hotel footer");
  check(!/Asanka|jollofmaster/i.test(docketBody), "kitchen docket free of legacy branding/wifi secrets");

  const before = await page.evaluate(() => window.__printCalled);
  await page.getByRole("button", { name: /Print Kitchen Docket/i }).click();
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => window.__printCalled);
  check(after === before + 1, "docket print button invokes the browser print dialog exactly once");

  // Print media: action chrome must disappear on paper.
  await page.emulateMedia({ media: "print" });
  const printHiddenControls = await page.getByRole("button", { name: /Print Kitchen Docket/i }).isVisible().catch(() => false);
  check(!printHiddenControls, "print media hides on-screen docket controls (clean paper output)");
  await page.screenshot({ path: SHOTS + "/2-docket-print-media.png", fullPage: true });
  await page.emulateMedia({ media: "screen" });

  // --- 3. Customer receipt print ---
  await page.getByRole("button", { name: /^Close$/ }).first().click();
  await page.locator('button, [role="button"], a').filter({ hasText: "Order History" }).first().click();
  await page.locator('button[title="Print / View Customer Receipt"]').first().click();
  await page.getByText(/Thermal Receipt Preview/).waitFor({ timeout: 60000 });
  await page.screenshot({ path: SHOTS + "/3-receipt.png" });
  const receiptBody = await page.locator("body").innerText();
  check(/Official VAT Invoice|Complimentary/i.test(receiptBody), "receipt shows invoice header block");
  check(/GH₵/.test(receiptBody), "receipt totals render in GH₵");
  check(!/Asanka|jollofmaster|Akosua/i.test(receiptBody), "receipt free of legacy name, fake cashier and wifi password");
  const beforeR = await page.evaluate(() => window.__printCalled);
  await page.getByRole("button", { name: /^Print Receipt$/i }).or(page.getByRole("button", { name: /^Print$/i })).first().click();
  await page.waitForTimeout(300);
  check((await page.evaluate(() => window.__printCalled)) === beforeR + 1, "receipt print button invokes the browser print dialog exactly once");
  await page.emulateMedia({ media: "print" });
  await page.screenshot({ path: SHOTS + "/4-receipt-print-media.png", fullPage: true });
  await page.emulateMedia({ media: "screen" });
  await page.getByRole("button", { name: /^Close$/ }).first().click();

  // --- 4. Cash drawer signal + shift ---
  await page.locator('button, [role="button"], a').filter({ hasText: "Cash Drawer" }).first().click();
  await page.getByText(/Shift Operations|Open Register Shift|Expected Drawer Cash/).first().waitFor({ timeout: 60000 });
  const drawerText = await page.locator("body").innerText();
  if (/Open Register Shift/i.test(drawerText)) {
    await page.getByRole("button", { name: /Open Register Shift/i }).first().click();
    await page.locator('input[type="number"]').first().fill("200");
    await page.locator('form:has(input[type="number"]) button[type="submit"]').first().click();
    await page.getByText(/Expected Drawer Cash|Register #1 Currently Open/i).first().waitFor({ timeout: 30000 });
  }
  await page.getByRole("button", { name: /^Open Drawer$/ }).click();
  await page.getByText(/Drawer-open request logged/i).waitFor({ timeout: 30000 });
  check(true, "drawer-open signal is logged with honest hardware instruction");
  await page.screenshot({ path: SHOTS + "/5-cash-drawer.png" });

  // --- 5. Hardware page printer test must be honest (no fake bridge) ---
  await page.locator('button, [role="button"], a').filter({ hasText: "Hardware & Tenders" }).first().click();
  await page.getByRole("button", { name: /Send ESC\/POS Test Feed/i }).click();
  await page.getByText(/browser print dialog/i).waitFor({ timeout: 30000 });
  check(true, "printer test reports the real browser-print workflow (no phantom network job)");
  await page.screenshot({ path: SHOTS + "/6-hardware-page.png" });

  console.log(`\n${pass} hardware/software-path checks passed. Physical cutter, paper feed and drawer kick remain on-site tests.`);
  await browser.close();
  process.exit(0);
})().catch(err => { console.error(err); process.exit(1); });
