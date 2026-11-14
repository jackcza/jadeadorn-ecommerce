import { expect, test } from "@playwright/test";
import { addProductToCart, fillCheckout } from "./helpers";

test("browse by category → detail → cart → mock pay → confirmation survives refresh", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /A little meaning/ })).toBeVisible();
  await page.getByTestId("category-link").filter({ hasText: "Natural Stone" }).click();

  await expect(page).toHaveURL(/\/category\/natural-stone$/);
  await expect(page.getByRole("heading", { level: 1, name: "Natural Stone" })).toBeVisible();
  await expect(page.getByTestId("product-card")).toHaveCount(4);

  await page.getByRole("link", { name: /Green Jade-Style Bead Bracelet/ }).first().click();
  await expect(page).toHaveURL(/\/products\/green-jade-style-bead-bracelet$/);
  await expect(page.getByTestId("detail-price")).toHaveText("$48.00");

  await page.getByRole("button", { name: "Increase quantity" }).click();
  await page.getByTestId("add-to-bag").click();
  await expect(page.getByTestId("cart-count")).toHaveText("2");

  await page.getByRole("link", { name: "View bag" }).click();
  await expect(page.getByTestId("cart-line")).toHaveCount(1);
  await expect(page.getByTestId("cart-subtotal")).toHaveText("$96.00");

  // Cart persists across reloads (localStorage).
  await page.reload();
  await expect(page.getByTestId("cart-subtotal")).toHaveText("$96.00");

  await page.getByTestId("go-to-checkout").click();
  await expect(page.getByTestId("test-payment-banner")).toContainText("TEST PAYMENT — NO REAL CHARGE");
  await fillCheckout(page);
  await page.getByTestId("place-order").click();

  await expect(page).toHaveURL(/\/orders\/[A-Za-z0-9_-]{20,}$/);
  const confirmation = page.getByTestId("order-confirmation");
  await expect(confirmation.getByTestId("order-number")).toHaveText(/^JA-\d{6}-[A-Z2-9]{6}$/);
  const orderNumber = await confirmation.getByTestId("order-number").textContent();
  await expect(confirmation.getByTestId("order-email")).toHaveText("jamie@example.com");
  await expect(confirmation.getByTestId("order-total")).toHaveText("$96.00");
  await expect(confirmation.getByTestId("payment-status")).toHaveText("Paid (test)");
  await expect(confirmation.getByTestId("order-status")).toHaveText("Confirmed");
  await expect(confirmation.getByTestId("order-item")).toContainText("Green Jade-Style Bead Bracelet");
  await expect(page.getByTestId("cart-count")).toHaveText("0");

  await page.reload();
  await expect(page.getByTestId("order-number")).toHaveText(orderNumber!);
  await expect(page.getByTestId("order-total")).toHaveText("$96.00");
});

test("declined test card shows an error, creates no order, and a retry succeeds", async ({ page }) => {
  await addProductToCart(page, "tigers-eye-stretch-bracelet");
  await page.goto("/checkout");
  await fillCheckout(page);
  await page.getByLabel("Test card — payment declined").check();

  const checkoutResponses: number[] = [];
  page.on("response", (r) => {
    if (r.url().endsWith("/api/checkout")) checkoutResponses.push(r.status());
  });
  await page.getByTestId("place-order").click();

  await expect(page.getByTestId("checkout-error")).toContainText(/declined/i);
  await expect(page.getByTestId("checkout-error")).toContainText(/no order was created/i);
  await expect(page).toHaveURL(/\/checkout$/);
  expect(checkoutResponses).toEqual([402]);
  await expect(page.getByTestId("cart-count")).toHaveText("1");

  await page.getByLabel("Test card — payment approved").check();
  await page.getByTestId("place-order").click();
  await expect(page).toHaveURL(/\/orders\//);
  await expect(page.getByTestId("payment-status")).toHaveText("Paid (test)");
  await expect(page.getByTestId("order-total")).toHaveText("$38.00");
  expect(checkoutResponses).toEqual([402, 201]);
});

test("empty bag cannot check out and unknown pages 404", async ({ page }) => {
  await page.goto("/checkout");
  await expect(page.getByTestId("checkout-empty")).toBeVisible();
  const res = await page.goto("/products/not-a-real-product");
  expect(res?.status()).toBe(404);
});
