"use client";

import Link from "next/link";
import { useCart } from "@/components/cart/CartProvider";

export function CartButton() {
  const { count, hydrated } = useCart();
  return (
    <Link
      href="/cart"
      className="relative inline-flex min-h-11 min-w-11 items-center justify-center gap-2 text-xs tracking-wider"
      aria-label={`Shopping bag, ${count} item${count === 1 ? "" : "s"}`}
      data-testid="cart-button"
    >
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <path d="M5 8h14l-1.2 12H6.2L5 8z" />
        <path d="M9 8V6a3 3 0 0 1 6 0v2" />
      </svg>
      <span className="hidden sm:inline">BAG</span>
      <span
        data-testid="cart-count"
        className="absolute top-0.5 right-0 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-gold px-1 text-[10px] font-semibold text-ink sm:static"
      >
        {hydrated ? count : 0}
      </span>
    </Link>
  );
}
