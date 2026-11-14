"use client";

import { useState } from "react";
import { useCart } from "@/components/cart/CartProvider";
import type { ProductDTO } from "@/lib/catalog";

export function QuickAddButton({ product }: { product: ProductDTO }) {
  const { add } = useCart();
  const [added, setAdded] = useState(false);
  return (
    <button
      type="button"
      className="min-h-11 w-full border border-line px-3 text-[10px] font-semibold tracking-[0.12em] uppercase transition-colors hover:bg-jade-700 hover:text-white sm:w-auto"
      aria-label={`Add ${product.name} to bag`}
      onClick={() => {
        add({
          productId: product.id,
          slug: product.slug,
          name: product.name,
          priceCents: product.priceCents,
          imageUrl: product.imageUrl,
        });
        setAdded(true);
        setTimeout(() => setAdded(false), 1500);
      }}
    >
      <span aria-live="polite">{added ? "Added ✓" : "Add to bag +"}</span>
    </button>
  );
}
