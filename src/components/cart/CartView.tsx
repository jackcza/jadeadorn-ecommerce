"use client";

import Link from "next/link";
import { useCart } from "@/components/cart/CartProvider";
import { MAX_QTY } from "@/lib/cart";
import { formatCents } from "@/lib/money";
import { useOnlineStatus } from "@/lib/use-online-status";

export function CartView() {
  const { lines, hydrated, subtotalCents, setQuantity, remove, removedNames, dismissRemoved } = useCart();
  const online = useOnlineStatus();

  if (!hydrated) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading your bag">
        {[0, 1].map((i) => (
          <div key={i} className="h-24 animate-pulse bg-soft" />
        ))}
      </div>
    );
  }

  const notice = removedNames.length > 0 && (
    <div role="alert" className="mb-5 flex items-start justify-between gap-3 border border-gold bg-gold-light/40 p-3 text-sm">
      <span>No longer available and removed from your bag: {removedNames.join(", ")}.</span>
      <button type="button" onClick={dismissRemoved} className="text-muted" aria-label="Dismiss">
        ×
      </button>
    </div>
  );

  if (lines.length === 0) {
    return (
      <>
        {notice}
        <div className="border border-dashed border-line px-6 py-14 text-center" data-testid="empty-cart">
          <p className="font-serif text-xl">Your bag is waiting for something lovely.</p>
          <Link href="/products" className="btn-primary mt-6">
            Browse the collection
          </Link>
        </div>
      </>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <div>
        {notice}
        <ul className="divide-y divide-line border-y border-line">
          {lines.map((l) => (
            <li key={l.productId} className="grid grid-cols-[72px_1fr] gap-4 py-5 sm:grid-cols-[96px_1fr_auto]" data-testid="cart-line">
              <Link href={`/products/${l.slug}`} className="grid aspect-square place-items-center bg-soft">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {l.imageUrl && <img src={l.imageUrl} alt="" className="h-4/5 w-4/5" />}
              </Link>
              <div className="min-w-0">
                <Link href={`/products/${l.slug}`} className="font-serif text-base leading-snug hover:underline">
                  {l.name}
                </Link>
                <div className="mt-1 text-xs text-muted">{formatCents(l.priceCents)} each</div>
                <div className="mt-3 flex items-center gap-4">
                  <div className="flex items-center border border-line" role="group" aria-label={`Quantity for ${l.name}`}>
                    <button
                      type="button"
                      className="h-11 w-10 disabled:opacity-40"
                      aria-label={`Decrease quantity of ${l.name}`}
                      onClick={() => setQuantity(l.productId, l.quantity - 1)}
                      disabled={l.quantity <= 1}
                    >
                      −
                    </button>
                    <span className="w-7 text-center text-sm" data-testid="line-qty">
                      {l.quantity}
                    </span>
                    <button
                      type="button"
                      className="h-11 w-10 disabled:opacity-40"
                      aria-label={`Increase quantity of ${l.name}`}
                      onClick={() => setQuantity(l.productId, l.quantity + 1)}
                      disabled={l.quantity >= MAX_QTY}
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    className="min-h-11 text-xs text-muted underline underline-offset-4 hover:text-danger"
                    onClick={() => remove(l.productId)}
                  >
                    Remove
                  </button>
                </div>
              </div>
              <div className="col-start-2 text-sm font-semibold sm:col-start-3 sm:text-right" data-testid="line-total">
                {formatCents(l.priceCents * l.quantity)}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <aside className="h-fit border border-line bg-paper p-5" aria-label="Order summary">
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd className="font-semibold" data-testid="cart-subtotal">
              {formatCents(subtotalCents)}
            </dd>
          </div>
          <div className="flex justify-between text-muted">
            <dt>Shipping</dt>
            <dd>Free (demo)</dd>
          </div>
          <div className="flex justify-between text-muted">
            <dt>Tax</dt>
            <dd>$0.00 (demo)</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          Final prices are confirmed by the server at checkout.
        </p>
        <Link href="/checkout" className="btn-primary mt-4 w-full" data-testid="go-to-checkout">
          Checkout
        </Link>
        {!online && (
          <p className="mt-3 text-xs text-[#7a5a1e]">You’re offline — you can review your bag, but checkout requires a connection.</p>
        )}
      </aside>
    </div>
  );
}
