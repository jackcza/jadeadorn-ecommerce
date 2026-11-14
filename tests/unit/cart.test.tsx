// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CartProvider, useCart } from "@/components/cart/CartProvider";
import {
  CART_STORAGE_KEY,
  addLine,
  cartCount,
  cartSubtotalCents,
  loadCart,
  parseCart,
  removeLine,
  saveCart,
  setLineQuantity,
  type CartLine,
} from "@/lib/cart";

const jade = { productId: "p1", slug: "green-jade", name: "Green Jade", priceCents: 4800, imageUrl: null };
const onyx = { productId: "p2", slug: "black-onyx", name: "Black Onyx", priceCents: 4200, imageUrl: null };

describe("cart operations", () => {
  it("adds, merges, clamps, updates and removes lines", () => {
    let lines: CartLine[] = [];
    lines = addLine(lines, jade, 2);
    lines = addLine(lines, jade, 1);
    lines = addLine(lines, onyx);
    expect(lines).toHaveLength(2);
    expect(lines[0].quantity).toBe(3);
    expect(cartCount(lines)).toBe(4);
    expect(cartSubtotalCents(lines)).toBe(3 * 4800 + 4200);

    lines = addLine(lines, jade, 50);
    expect(lines[0].quantity).toBe(10);
    lines = setLineQuantity(lines, "p2", 5);
    expect(lines[1].quantity).toBe(5);
    lines = setLineQuantity(lines, "p2", 0);
    expect(lines.map((l) => l.productId)).toEqual(["p1"]);
    expect(removeLine(lines, "p1")).toEqual([]);
  });
});

describe("cart persistence (4)", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("round-trips through localStorage", () => {
    const lines = addLine(addLine([], jade, 2), onyx, 1);
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
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
    let api: ReturnType<typeof useCart> | null = null;
    function Probe() {
      api = useCart();
      return <span data-testid="count">{api.count}</span>;
    }

    const first = render(
      <CartProvider>
        <Probe />
      </CartProvider>,
    );
    await act(async () => {
      api!.add(jade, 2);
      api!.add(onyx, 1);
    });
    expect(screen.getByTestId("count").textContent).toBe("3");
    first.unmount();

    render(
      <CartProvider>
        <Probe />
      </CartProvider>,
    );
    await act(async () => {});
    expect(screen.getByTestId("count").textContent).toBe("3");
    expect(api!.lines.map((l) => [l.productId, l.quantity])).toEqual([
      ["p1", 2],
      ["p2", 1],
    ]);
  });
});
