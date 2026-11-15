// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CartProvider, useCart } from "@/components/cart/CartProvider";
import { CART_STORAGE_KEY, loadCart, parseCart, saveCart } from "@/lib/cart";

const jade = { productId: "p1", slug: "green-jade", name: "Green Jade", priceCents: 4800, imageUrl: null };
const onyx = { productId: "p2", slug: "black-onyx", name: "Black Onyx", priceCents: 4200, imageUrl: null };

const offline = () => vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));

/** Renders a CartProvider and returns a getter for the latest useCart() value. */
async function renderCart() {
  let api: ReturnType<typeof useCart> | null = null;
  function Probe() {
    api = useCart();
    return <span data-testid="count">{api.count}</span>;
  }
  const view = render(
    <CartProvider>
      <Probe />
    </CartProvider>,
  );
  await act(async () => {});
  return { cart: () => api!, unmount: view.unmount };
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("cart operations", () => {
  it("adds, merges, clamps, updates and removes lines", async () => {
    offline();
    const { cart } = await renderCart();

    await act(async () => {
      cart().add(jade, 2);
      cart().add(jade, 1);
      cart().add(onyx);
    });
    expect(cart().lines).toHaveLength(2);
    expect(cart().lines[0].quantity).toBe(3);
    expect(cart().count).toBe(4);
    expect(cart().subtotalCents).toBe(3 * 4800 + 4200);

    await act(async () => cart().add(jade, 50));
    expect(cart().lines[0].quantity).toBe(10);
    await act(async () => cart().setQuantity("p2", 5));
    expect(cart().lines[1].quantity).toBe(5);
    await act(async () => cart().setQuantity("p2", 0));
    expect(cart().lines.map((l) => l.productId)).toEqual(["p1"]);
    await act(async () => cart().remove("p1"));
    expect(cart().lines).toEqual([]);
  });

  it("refreshes prices from the catalog and drops products that are no longer sold", async () => {
    saveCart(localStorage, [
      { ...jade, quantity: 2 },
      { ...onyx, quantity: 1 },
    ]);
    const catalog = { products: [{ id: "p1", slug: "green-jade", name: "Green Jade", priceCents: 5200, imageUrl: null }] };
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(JSON.stringify(catalog)))));

    const { cart } = await renderCart();
    await act(async () => {});

    expect(cart().lines).toEqual([{ ...jade, priceCents: 5200, quantity: 2 }]);
    expect(cart().removedNames).toEqual(["Black Onyx"]);
    expect(loadCart(localStorage)).toEqual(cart().lines);
  });
});

describe("cart persistence (4)", () => {
  it("round-trips through localStorage", () => {
    const lines = [
      { ...jade, quantity: 2 },
      { ...onyx, quantity: 1 },
    ];
    saveCart(localStorage, lines);
    expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY)!)).toMatchObject({ version: 1 });
    expect(loadCart(localStorage)).toEqual(lines);
  });

  it("falls back to an empty cart for missing, corrupt or tampered data", () => {
    expect(parseCart(null)).toEqual([]);
    expect(parseCart("{oops")).toEqual([]);
    expect(parseCart(JSON.stringify({ version: 99, lines: [] }))).toEqual([]);
    const tampered = parseCart(
      JSON.stringify({ version: 1, lines: [{ ...jade, quantity: 999 }, { productId: 1 }, { ...jade, quantity: 1 }] }),
    );
    expect(tampered).toEqual([{ ...jade, quantity: 10 }]);
  });

  it("CartProvider restores the cart after a reload (remount)", async () => {
    offline();
    const first = await renderCart();
    await act(async () => {
      first.cart().add(jade, 2);
      first.cart().add(onyx, 1);
    });
    expect(screen.getByTestId("count").textContent).toBe("3");
    first.unmount();

    const second = await renderCart();
    expect(screen.getByTestId("count").textContent).toBe("3");
    expect(second.cart().lines.map((l) => [l.productId, l.quantity])).toEqual([
      ["p1", 2],
      ["p2", 1],
    ]);
  });
});
