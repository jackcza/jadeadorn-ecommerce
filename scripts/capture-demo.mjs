// Captures demo screenshots (375px + 1440px) and a mobile purchase-flow video from a running
// production server. Usage: node scripts/capture-demo.mjs [baseUrl] [outDir]
import { mkdirSync, readdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import { chromium, devices } from "@playwright/test";

const BASE = process.argv[2] ?? "http://localhost:3000";
const OUT = process.argv[3] ?? "demo-output";
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = {
  mobile: { ...devices["iPhone 13"], viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
};

async function fillCheckout(page) {
  await page.getByLabel("Full name").fill("Jamie Chen");
  await page.getByLabel("Email").fill("jamie@example.com");
  await page.getByLabel(/^Address line 1/).fill("123 Main St");
  await page.getByLabel(/^Address line 2/).fill("Apt 4");
  await page.getByLabel("City").fill("Boston");
  await page.getByLabel("State / region").fill("MA");
  await page.getByLabel("ZIP / postal code").fill("02110");
}

async function waitForSw(page) {
  await page.evaluate(() => navigator.serviceWorker.ready);
  if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) {
    await page.reload();
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  }
}

async function hideInstallPrompt(page) {
  await page.addStyleTag({ content: '[data-testid="install-prompt"]{display:none!important}' });
}

async function capture(browser, name, options) {
  const context = await browser.newContext({ ...options, baseURL: BASE });
  const page = await context.newPage();
  const shot = async (file, fullPage = false) => {
    await page.waitForTimeout(250);
    await page.screenshot({ path: join(OUT, `${name}-${file}.png`), fullPage });
    console.log(`  ${name}-${file}.png`);
  };

  // PWA install UI: iPhone UA shows the iOS "Add to Home Screen" hint; on desktop Chromium we
  // dispatch a synthetic beforeinstallprompt (headless Chrome never fires the real one).
  await page.goto("/");
  await waitForSw(page);
  if (name === "desktop") {
    await page.evaluate(() => {
      const e = new Event("beforeinstallprompt");
      e.prompt = async () => {};
      e.userChoice = Promise.resolve({ outcome: "dismissed" });
      window.dispatchEvent(e);
    });
  }
  await page.waitForSelector('[data-testid="install-prompt"]');
  await shot("10-pwa-install-prompt");
  await hideInstallPrompt(page);
  await shot("01-home");
  await shot("01-home-full", true);

  await page.getByTestId("category-link").filter({ hasText: "Natural Stone" }).click();
  await page.waitForURL(/category\/natural-stone/);
  await hideInstallPrompt(page);
  await shot("02-category", true);

  await page.getByRole("link", { name: /Green Jade-Style Bead Bracelet/ }).first().click();
  await page.waitForURL(/products\/green-jade/);
  await hideInstallPrompt(page);
  await shot("03-product-detail");
  await page.getByRole("button", { name: "Increase quantity" }).click();
  await page.getByTestId("add-to-bag").click();
  await page.getByTestId("added-notice").waitFor();
  await shot("04-added-to-cart");

  await page.goto("/products/sandalwood-prayer-mala");
  await page.getByTestId("add-to-bag").click();
  await page.goto("/cart");
  await hideInstallPrompt(page);
  await page.getByTestId("cart-line").first().waitFor();
  await shot("05-cart", true);

  await page.goto("/checkout");
  await hideInstallPrompt(page);
  await fillCheckout(page);
  await shot("06-checkout", true);

  await page.getByLabel("Test card — payment declined").check();
  await page.getByTestId("place-order").click();
  await page.getByTestId("checkout-error").waitFor();
  await page.getByTestId("checkout-error").scrollIntoViewIfNeeded();
  await shot("07-mock-payment-declined");

  await page.getByLabel("Test card — payment approved").check();
  await page.getByTestId("place-order").click();
  await page.waitForURL(/\/orders\//);
  await hideInstallPrompt(page);
  await shot("08-mock-payment-success-confirmation", true);
  await page.reload();
  await hideInstallPrompt(page);
  await page.getByTestId("order-number").waitFor();
  await shot("09-confirmation-after-refresh", true);

  // Manifest + service worker status, read live from the browser.
  const pwa = await page.evaluate(async () => {
    const manifest = await (await fetch("/manifest.webmanifest")).json();
    const reg = await navigator.serviceWorker.getRegistration();
    const caches_ = {};
    for (const key of await caches.keys()) {
      caches_[key] = (await (await caches.open(key)).keys()).map((r) => new URL(r.url).pathname + new URL(r.url).search);
    }
    return { manifest, sw: reg?.active?.scriptURL, state: reg?.active?.state, caches: caches_ };
  });
  const sensitive = Object.values(pwa.caches).flat().filter((u) => /^\/(orders|api\/checkout|api\/orders)/.test(u));
  await page.setContent(`<!doctype html><meta name=viewport content="width=device-width">
    <body style="font:14px system-ui;margin:16px;background:#fbf9f5;color:#26251f">
    <h2 style="font-family:Georgia">JadeAdorn PWA status (live from ${BASE})</h2>
    <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
      ${pwa.manifest.icons.map((i) => `<figure style="margin:0;text-align:center"><img src="${BASE}${i.src}" width=72 height=72 style="border:1px solid #ddd"><figcaption style="font-size:11px">${i.sizes} ${i.purpose}</figcaption></figure>`).join("")}
    </div>
    <h3>manifest.webmanifest</h3><pre style="white-space:pre-wrap;background:#fff;padding:10px;border:1px solid #e6e0d6">${JSON.stringify(pwa.manifest, null, 2)}</pre>
    <h3>Service worker</h3><p>${pwa.sw} — <b>${pwa.state}</b></p>
    <h3>Cache Storage (${Object.values(pwa.caches).flat().length} entries)</h3>
    <p>Sensitive entries (/orders, /api/checkout, /api/orders): <b>${sensitive.length}</b></p>
    ${Object.entries(pwa.caches).map(([k, v]) => `<b>${k}</b><ul style="font-size:12px">${v.filter((u) => !u.startsWith("/_next")).map((u) => `<li>${u}</li>`).join("")}<li>…plus ${v.filter((u) => u.startsWith("/_next")).length} /_next/static assets</li></ul>`).join("")}
    </body>`);
  await shot("10-pwa-manifest-and-sw", true);

  // Offline: cached product browsable, uncached page -> offline page, checkout blocked.
  await page.goto("/products/sandalwood-prayer-mala");
  await page.getByTestId("add-to-bag").click();
  await page.goto("/products/green-jade-style-bead-bracelet");
  await page.goto("/checkout");
  await page.goto("/cart");
  await page.waitForTimeout(500);
  await context.setOffline(true);
  await page.goto("/products/green-jade-style-bead-bracelet");
  await hideInstallPrompt(page);
  await page.getByTestId("offline-banner").waitFor();
  await shot("11-offline-browsing-cached-product");
  await page.goto("/cart");
  await hideInstallPrompt(page);
  await page.getByTestId("cart-line").first().waitFor();
  await shot("11-offline-cart-persists", true);
  await page.goto("/products/ocean-blue-bead-bracelet");
  await hideInstallPrompt(page);
  await page.getByTestId("offline-page").waitFor();
  await shot("12-offline-uncached-page");
  await page.goto("/checkout");
  await hideInstallPrompt(page);
  await page.getByTestId("offline-checkout-notice").waitFor();
  await page.getByTestId("place-order").scrollIntoViewIfNeeded();
  await shot("13-offline-checkout-blocked");
  await shot("13-offline-checkout-blocked-full", true);
  await context.close();
}

async function recordMobileFlow(browser) {
  const videoDir = join(OUT, "video-tmp");
  const context = await browser.newContext({
    ...VIEWPORTS.mobile,
    deviceScaleFactor: 1,
    baseURL: BASE,
    recordVideo: { dir: videoDir, size: { width: 375, height: 812 } },
  });
  const page = await context.newPage();
  const pause = (ms = 900) => page.waitForTimeout(ms);
  await page.goto("/");
  await hideInstallPrompt(page);
  await pause(1200);
  await page.mouse.wheel(0, 500);
  await pause();
  await page.getByTestId("category-link").filter({ hasText: "Natural Stone" }).click();
  await page.waitForURL(/category/);
  await hideInstallPrompt(page);
  await pause();
  await page.getByRole("link", { name: /Green Jade-Style Bead Bracelet/ }).first().click();
  await page.waitForURL(/products\//);
  await hideInstallPrompt(page);
  await pause();
  await page.getByRole("button", { name: "Increase quantity" }).click();
  await pause(500);
  await page.getByTestId("add-to-bag").click();
  await pause();
  await page.getByRole("link", { name: "View bag" }).click();
  await page.waitForURL(/cart/);
  await hideInstallPrompt(page);
  await pause();
  await page.getByTestId("go-to-checkout").click();
  await page.waitForURL(/checkout/);
  await hideInstallPrompt(page);
  await pause(600);
  const type = async (label, value) => {
    const field = page.getByLabel(label);
    await field.scrollIntoViewIfNeeded();
    await field.pressSequentially(value, { delay: 45 });
  };
  await type("Full name", "Jamie Chen");
  await type("Email", "jamie@example.com");
  await type(/^Address line 1/, "123 Main St");
  await type("City", "Boston");
  await type("State / region", "MA");
  await type("ZIP / postal code", "02110");
  await pause(500);
  const declined = page.getByLabel("Test card — payment declined");
  await declined.scrollIntoViewIfNeeded();
  await pause(500);
  await declined.check();
  await pause(800);
  await page.getByTestId("place-order").scrollIntoViewIfNeeded();
  await pause(600);
  await page.getByTestId("place-order").click();
  await page.getByTestId("checkout-error").waitFor();
  await page.getByTestId("checkout-error").scrollIntoViewIfNeeded();
  await pause(2500);
  const approved = page.getByLabel("Test card — payment approved");
  await approved.scrollIntoViewIfNeeded();
  await pause(700);
  await approved.check();
  await pause(1000);
  await page.getByTestId("place-order").scrollIntoViewIfNeeded();
  await pause(1000);
  await page.getByTestId("place-order").click();
  await page.waitForURL(/\/orders\//);
  await hideInstallPrompt(page);
  await pause(2500);
  await page.mouse.wheel(0, 450);
  await pause(1500);
  await page.reload();
  await hideInstallPrompt(page);
  await page.evaluate(() => {
    const note = document.createElement("div");
    note.textContent = "↻ Page reloaded — order loaded from SQLite";
    note.style.cssText = "position:fixed;left:8px;right:8px;bottom:8px;z-index:99;background:#354d40;color:#fff;padding:10px;font:13px system-ui;text-align:center";
    document.body.appendChild(note);
  });
  await pause(2500);
  await page.mouse.wheel(0, 450);
  await pause(1500);
  await context.close();
  const [file] = readdirSync(videoDir);
  renameSync(join(videoDir, file), join(OUT, "mobile-purchase-flow.webm"));
  console.log("  mobile-purchase-flow.webm");
}

const browser = await chromium.launch();
if (!process.argv.includes("--video-only")) {
  for (const [name, options] of Object.entries(VIEWPORTS)) {
    console.log(`Capturing ${name}…`);
    await capture(browser, name, options);
  }
}
await recordMobileFlow(browser);
await browser.close();
