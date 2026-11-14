"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  CART_STORAGE_KEY,
  addLine,
  cartCount,
  cartSubtotalCents,
  loadCart,
  removeLine,
  saveCart,
  setLineQuantity,
  type CartLine,
} from "@/lib/cart";

interface CartContextValue {
  lines: CartLine[];
  hydrated: boolean;
  count: number;
  subtotalCents: number;
  add: (item: Omit<CartLine, "quantity">, qty?: number) => void;
  setQuantity: (productId: string, qty: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  /** Names of cart items removed because they are no longer available. */
  removedNames: string[];
  dismissRemoved: () => void;
}

interface CatalogProduct {
  id: string;
  slug: string;
  name: string;
  priceCents: number;
  imageUrl: string | null;
}

const CartContext = createContext<CartContextValue | null>(null);

const storage = () => (typeof window === "undefined" ? undefined : window.localStorage);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setLines(loadCart(storage()));
    setHydrated(true);
    const onStorage = (e: StorageEvent) => {
      if (e.key === CART_STORAGE_KEY) setLines(loadCart(storage()));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const update = useCallback((fn: (prev: CartLine[]) => CartLine[]) => {
    setLines((prev) => {
      const next = fn(prev);
      saveCart(storage(), next);
      return next;
    });
  }, []);

  // Refresh display names/prices from the catalog API (served from the SW cache when offline)
  // and drop products that are no longer sold. The server still reprices at checkout.
  const [removedNames, setRemovedNames] = useState<string[]>([]);
  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    fetch("/api/products")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { products?: CatalogProduct[] } | null) => {
        if (cancelled || !data?.products) return;
        const byId = new Map(data.products.map((p) => [p.id, p]));
        update((prev) => {
          const gone = prev.filter((l) => !byId.has(l.productId));
          if (gone.length) setRemovedNames(gone.map((l) => l.name));
          const next = prev
            .filter((l) => byId.has(l.productId))
            .map((l) => {
              const p = byId.get(l.productId)!;
              return { ...l, name: p.name, slug: p.slug, priceCents: p.priceCents, imageUrl: p.imageUrl };
            });
          const changed = JSON.stringify(next) !== JSON.stringify(prev);
          return changed ? next : prev;
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [hydrated, update]);

  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      hydrated,
      count: cartCount(lines),
      subtotalCents: cartSubtotalCents(lines),
      add: (item, qty = 1) => update((prev) => addLine(prev, item, qty)),
      setQuantity: (id, qty) => update((prev) => setLineQuantity(prev, id, qty)),
      remove: (id) => update((prev) => removeLine(prev, id)),
      clear: () => update(() => []),
      removedNames,
      dismissRemoved: () => setRemovedNames([]),
    }),
    [lines, hydrated, update, removedNames],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
