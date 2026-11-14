import { expect, test } from "@playwright/test";
import { addProductToCart, isCached, waitForServiceWorker } from "./helpers";

test("PWA: manifest and service worker are served", async ({ page, request }) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest).toMatchObject({ name: "JadeAdorn", display: "standalone", start_url: "/" });
  await page.goto("/");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");
  await waitForServiceWorker(page);
  expect(await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL)).toMatch(/\/sw\.js$/);
});

test("offline: cached products stay browsable, cart persists, checkout is blocked", async ({ page, context }) => {
  await page.goto("/");
  await waitForServiceWorker(page);

  // Visit pages online so the service worker caches them.
  await addProductToCart(page, "sandalwood-prayer-mala", 2);
  await page.goto("/cart");
  await expect(page.getByTestId("cart-line")).toHaveCount(1);
  await page.goto("/checkout");
  await expect(page.getByTestId("place-order")).toBeEnabled();
  await expect.poll(() => isCached(page, "/products/sandalwood-prayer-mala")).toBe(true);
  await expect.poll(() => isCached(page, "/checkout")).toBe(true);
  await expect.poll(() => isCached(page, "/api/products")).toBe(true);

  // Pages reached through in-app links (client-side navigation) are cached too.
  await page.goto("/products/sandalwood-prayer-mala");
  await page.getByRole("link", { name: "Buddhist Mala" }).first().click();
  await expect(page).toHaveURL(/\/category\/buddhist-mala$/);
  await expect.poll(() => isCached(page, "/category/buddhist-mala")).toBe(true);
  await page.goto("/checkout");

  const checkoutRequests: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/checkout")) checkoutRequests.push(r.method());
  });

  await context.setOffline(true);

  await page.goto("/products/sandalwood-prayer-mala");
  await expect(page.getByRole("heading", { level: 1, name: "Sandalwood Prayer Mala" })).toBeVisible();
  await expect(page.getByTestId("offline-banner")).toBeVisible();
  await expect(page.getByTestId("cart-count")).toHaveText("2");

  await page.goto("/category/buddhist-mala");
  await expect(page.getByRole("heading", { level: 1, name: "Buddhist Mala" })).toBeVisible();

  // A product page never visited falls back to the offline page.
  await page.goto("/products/ocean-blue-bead-bracelet");
  await expect(page.getByTestId("offline-page")).toBeVisible();

  await page.goto("/cart");
  await expect(page.getByTestId("cart-line")).toHaveCount(1);

  // In-app link clicks while offline also land on cached pages.
  await page.getByRole("link", { name: "Sandalwood Prayer Mala", exact: true }).click();
  await expect(page).toHaveURL(/\/products\/sandalwood-prayer-mala$/);
  await expect(page.getByRole("heading", { level: 1, name: "Sandalwood Prayer Mala" })).toBeVisible();

  await page.goto("/checkout");
  await expect(page.getByTestId("offline-checkout-notice")).toContainText("Payment requires an internet connection");
  await expect(page.getByTestId("place-order")).toBeDisabled();
  await expect(page.getByTestId("place-order")).toHaveText(/requires connection/i);
  expect(checkoutRequests).toEqual([]);

  // Confirmation pages are never cached.
  expect(await page.evaluate(async () => (await caches.keys()).length)).toBeGreaterThan(0);
  const cachedOrderUrls = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys()) {
      for (const req of await (await caches.open(name)).keys()) urls.push(new URL(req.url).pathname);
    }
    return urls.filter((u) => u.startsWith("/orders") || u.startsWith("/api/checkout") || u.startsWith("/api/orders"));
  });
  expect(cachedOrderUrls).toEqual([]);

  await context.setOffline(false);
  await page.reload();
  await expect(page.getByTestId("place-order")).toBeEnabled();
});
