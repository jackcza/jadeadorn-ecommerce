export const CART_STORAGE_KEY = "jadeadorn.cart.v1";
export const MAX_QTY = 10;

/** Display snapshot only. The server reprices every order from the database. */
export interface CartLine {
  productId: string;
  slug: string;
  name: string;
  priceCents: number;
  imageUrl: string | null;
  quantity: number;
}

interface StoredCart {
  version: 1;
  lines: CartLine[];
}

const clampQty = (q: number) => Math.min(MAX_QTY, Math.max(1, Math.floor(q)));

function isLine(v: unknown): v is CartLine {
  if (!v || typeof v !== "object") return false;
  const l = v as Record<string, unknown>;
  return (
    typeof l.productId === "string" &&
    typeof l.slug === "string" &&
    typeof l.name === "string" &&
    typeof l.priceCents === "number" &&
    Number.isInteger(l.priceCents) &&
    l.priceCents >= 0 &&
    typeof l.quantity === "number" &&
    l.quantity >= 1 &&
    (l.imageUrl === null || typeof l.imageUrl === "string")
  );
}

/** Tolerates missing, corrupt or old data by falling back to an empty cart. */
export function parseCart(raw: string | null): CartLine[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as Partial<StoredCart>;
    if (data?.version !== 1 || !Array.isArray(data.lines)) return [];
    const seen = new Set<string>();
    return data.lines.filter(isLine).flatMap((l) => {
      if (seen.has(l.productId)) return [];
      seen.add(l.productId);
      return [{ ...l, quantity: clampQty(l.quantity) }];
    });
  } catch {
    return [];
  }
}

export function serializeCart(lines: CartLine[]): string {
  return JSON.stringify({ version: 1, lines } satisfies StoredCart);
}

export function loadCart(storage: Pick<Storage, "getItem"> | undefined): CartLine[] {
  try {
    return parseCart(storage?.getItem(CART_STORAGE_KEY) ?? null);
  } catch {
    return [];
  }
}

export function saveCart(storage: Pick<Storage, "setItem"> | undefined, lines: CartLine[]) {
  try {
    storage?.setItem(CART_STORAGE_KEY, serializeCart(lines));
  } catch {
    // Storage full or disabled (e.g. private mode): the cart still works for this session.
  }
}

export function addLine(lines: CartLine[], item: Omit<CartLine, "quantity">, qty = 1): CartLine[] {
  const found = lines.find((l) => l.productId === item.productId);
  if (found) {
    return lines.map((l) =>
      l.productId === item.productId ? { ...l, ...item, quantity: clampQty(l.quantity + qty) } : l,
    );
  }
  return [...lines, { ...item, quantity: clampQty(qty) }];
}

export function setLineQuantity(lines: CartLine[], productId: string, qty: number): CartLine[] {
  if (qty < 1) return removeLine(lines, productId);
  return lines.map((l) => (l.productId === productId ? { ...l, quantity: clampQty(qty) } : l));
}

export function removeLine(lines: CartLine[], productId: string): CartLine[] {
  return lines.filter((l) => l.productId !== productId);
}

export const cartCount = (lines: CartLine[]) => lines.reduce((n, l) => n + l.quantity, 0);
export const cartSubtotalCents = (lines: CartLine[]) =>
  lines.reduce((n, l) => n + l.priceCents * l.quantity, 0);
