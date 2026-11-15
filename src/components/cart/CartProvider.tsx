"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { CART_STORAGE_KEY, clampQuantity, loadCart, saveCart, type CartLine } from "@/lib/cart";

type NewCartItem = Omit<CartLine, "quantity">;

interface CartContextValue {
  lines: CartLine[];
  /** false until the saved cart has been read; the server render and first client render are always empty. */
  hydrated: boolean;
  count: number;
  subtotalCents: number;
  add: (item: NewCartItem, quantity?: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
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

function getStorage() {
  return typeof window === "undefined" ? undefined : window.localStorage;
}

/** Current catalog, or null when the request fails (offline with nothing cached yet). */
async function fetchCatalog(): Promise<CatalogProduct[] | null> {
  try {
    const res = await fetch("/api/products");
    if (!res.ok) return null;
    const data = (await res.json()) as { products?: CatalogProduct[] };
    return data.products ?? null;
  } catch {
    return null;
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [removedNames, setRemovedNames] = useState<string[]>([]);

  // Load the saved cart once the page is in the browser, and follow edits made in other tabs
  // (the storage event does not fire in the tab that wrote the value).
  useEffect(() => {
    setLines(loadCart(getStorage()));
    setHydrated(true);

    function onStorage(e: StorageEvent) {
      if (e.key === CART_STORAGE_KEY) setLines(loadCart(getStorage()));
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Save after every change. Waits for the load above, so the initial empty cart never overwrites the saved one.
  useEffect(() => {
    if (hydrated) saveCart(getStorage(), lines);
  }, [hydrated, lines]);

  // Refresh names and prices from the catalog (served from the SW cache when offline) and drop
  // products that are no longer sold. Display only: the server reprices every order at checkout.
  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;

    fetchCatalog().then((products) => {
      if (cancelled || !products) return;
      const catalog = new Map(products.map((p) => [p.id, p]));

      setLines((current) => {
        const gone = current.filter((line) => !catalog.has(line.productId));
        if (gone.length > 0) setRemovedNames(gone.map((line) => line.name));

        return current
          .filter((line) => catalog.has(line.productId))
          .map((line) => {
            const product = catalog.get(line.productId)!;
            return {
              ...line,
              name: product.name,
              slug: product.slug,
              priceCents: product.priceCents,
              imageUrl: product.imageUrl,
            };
          });
      });
    });

    return () => {
      cancelled = true;
    };
  }, [hydrated]);

  // The actions below build the new cart from `current` (the latest state), not from `lines`,
  // so several clicks before the next render all count.

  function add(item: NewCartItem, quantity = 1) {
    setLines((current) => {
      const existing = current.find((line) => line.productId === item.productId);
      if (!existing) {
        return [...current, { ...item, quantity: clampQuantity(quantity) }];
      }
      return current.map((line) =>
        line.productId === item.productId
          ? { ...line, ...item, quantity: clampQuantity(line.quantity + quantity) }
          : line,
      );
    });
  }

  function setQuantity(productId: string, quantity: number) {
    setLines((current) => {
      if (quantity < 1) {
        return current.filter((line) => line.productId !== productId);
      }
      return current.map((line) =>
        line.productId === productId ? { ...line, quantity: clampQuantity(quantity) } : line,
      );
    });
  }

  function remove(productId: string) {
    setLines((current) => current.filter((line) => line.productId !== productId));
  }

  function clear() {
    setLines([]);
  }

  function dismissRemoved() {
    setRemovedNames([]);
  }

  const count = lines.reduce((sum, line) => sum + line.quantity, 0);
  const subtotalCents = lines.reduce((sum, line) => sum + line.priceCents * line.quantity, 0);

  const value: CartContextValue = {
    lines,
    hydrated,
    count,
    subtotalCents,
    add,
    setQuantity,
    remove,
    clear,
    removedNames,
    dismissRemoved,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
