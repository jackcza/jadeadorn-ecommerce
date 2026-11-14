import { expect, type Page } from "@playwright/test";

export async function fillCheckout(page: Page) {
  await page.getByLabel("Full name").fill("Jamie Chen");
  await page.getByLabel("Email").fill("jamie@example.com");
  await page.getByLabel(/^Address line 1/).fill("123 Main St");
  await page.getByLabel("City").fill("Boston");
  await page.getByLabel("State / region").fill("MA");
  await page.getByLabel("ZIP / postal code").fill("02110");
}

export async function addProductToCart(page: Page, slug: string, quantity = 1) {
  await page.goto(`/products/${slug}`);
  for (let i = 1; i < quantity; i++) await page.getByRole("button", { name: "Increase quantity" }).click();
  await expect(page.getByTestId("detail-qty")).toHaveText(String(quantity));
  await page.getByTestId("add-to-bag").click();
  await expect(page.getByTestId("added-notice")).toBeVisible();
}

/** Waits until the service worker is active and controlling this page. */
export async function waitForServiceWorker(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) {
    await page.reload();
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  }
}

export async function isCached(page: Page, path: string) {
  return page.evaluate(async (p) => !!(await caches.match(p)), path);
}
