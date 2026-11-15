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

/** Rounds down and keeps the quantity between 1 and MAX_QTY. */
export const clampQuantity = (q: number) => Math.min(MAX_QTY, Math.max(1, Math.floor(q)));

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
      return [{ ...l, quantity: clampQuantity(l.quantity) }];
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
