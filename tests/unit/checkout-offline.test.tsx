// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CartProvider } from "@/components/cart/CartProvider";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import { CART_STORAGE_KEY, serializeCart } from "@/lib/cart";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", { configurable: true, get: () => value });
  window.dispatchEvent(new Event(value ? "online" : "offline"));
}

async function renderCheckout() {
  render(
    <CartProvider>
      <CheckoutForm />
    </CartProvider>,
  );
  await act(async () => {});
}

describe("offline checkout is blocked (11)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.setItem(
      CART_STORAGE_KEY,
      serializeCart([{ productId: "p1", slug: "green-jade", name: "Green Jade", priceCents: 4800, imageUrl: null, quantity: 1 }]),
    );
    // Catalog sync GET fails (offline); any POST would be recorded here.
    fetchMock = vi.fn(() => Promise.reject(new TypeError("Failed to fetch")));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    localStorage.clear();
    setOnline(true);
  });

  const checkoutPosts = () => fetchMock.mock.calls.filter(([url]) => String(url).includes("/api/checkout"));

  it("disables the pay button and explains that payment requires a connection", async () => {
    setOnline(false);
    await renderCheckout();

    const button = screen.getByTestId("place-order") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.textContent).toMatch(/requires connection/i);
    expect(screen.getByTestId("offline-checkout-notice").textContent).toMatch(/requires an internet connection/i);
    expect(screen.getByTestId("test-payment-banner").textContent).toContain("TEST PAYMENT — NO REAL CHARGE");

    fireEvent.submit(screen.getByTestId("checkout-form"));
    await act(async () => {});
    expect(checkoutPosts()).toHaveLength(0);
  });

  it("re-enables checkout when the connection returns, and blocks again when it drops", async () => {
    setOnline(true);
    await renderCheckout();
    const button = screen.getByTestId("place-order") as HTMLButtonElement;
    expect(button.disabled).toBe(false);

    act(() => setOnline(false));
    expect(button.disabled).toBe(true);
    act(() => setOnline(true));
    expect(button.disabled).toBe(false);
  });

  it("never fakes an order when the network request fails", async () => {
    setOnline(true);
    await renderCheckout();
    const fill = (id: string, value: string) => fireEvent.change(screen.getByLabelText(new RegExp(`^${id}`, "i")), { target: { value } });
    fill("Full name", "Jamie Chen");
    fill("Email", "jamie@example.com");
    fill("Address line 1", "123 Main St");
    fill("City", "Boston");
    fill("State", "MA");
    fill("ZIP", "02110");

    fireEvent.submit(screen.getByTestId("checkout-form"));
    await act(async () => {});
    expect(checkoutPosts()).toHaveLength(1);
    expect(screen.getByTestId("checkout-error").textContent).toMatch(/couldn’t reach the server/i);
    // Cart is kept for a retry.
    expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY)!).lines).toHaveLength(1);
  });
});
