"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/components/cart/CartProvider";
import type { ProductDTO } from "@/lib/catalog";
import { MAX_QTY } from "@/lib/cart";

export function AddToCartPanel({ product }: { product: ProductDTO }) {
  const { add, lines } = useCart();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState<number | null>(null);
  const inCart = lines.find((l) => l.productId === product.id)?.quantity ?? 0;

  return (
    <div className="mt-6">
      <div className="flex items-stretch gap-3">
        <div className="flex items-center border border-line" role="group" aria-label="Quantity">
          <button
            type="button"
            className="h-12 w-11 text-lg disabled:opacity-40"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            disabled={qty <= 1}
            aria-label="Decrease quantity"
          >
            −
          </button>
          <span className="w-8 text-center text-sm" data-testid="detail-qty" aria-live="polite">
            {qty}
          </span>
          <button
            type="button"
            className="h-12 w-11 text-lg disabled:opacity-40"
            onClick={() => setQty((q) => Math.min(MAX_QTY, q + 1))}
            disabled={qty >= MAX_QTY}
            aria-label="Increase quantity"
          >
            +
          </button>
        </div>
        <button
          type="button"
          className="btn-primary flex-1"
          data-testid="add-to-bag"
          onClick={() => {
            add(
              {
                productId: product.id,
                slug: product.slug,
                name: product.name,
                priceCents: product.priceCents,
                imageUrl: product.imageUrl,
              },
              qty,
            );
            setAdded(qty);
          }}
        >
          Add to bag
        </button>
      </div>
      <div aria-live="polite" className="min-h-6">
        {added !== null && (
          <div className="mt-4 flex flex-wrap items-center gap-3 border border-jade-100 bg-jade-100/60 p-3 text-sm" data-testid="added-notice">
            <span>
              Added {added} to your bag{inCart ? ` (${inCart} total)` : ""}.
            </span>
            <Link href="/cart" className="font-semibold text-jade-700 underline underline-offset-4">
              View bag
            </Link>
            <Link href="/products" className="text-muted underline underline-offset-4">
              Continue shopping
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
