import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <div className="mx-auto max-w-lg px-5 py-16 text-center" data-testid="offline-page">
      <div className="eyebrow">No connection</div>
      <h1 className="mt-3 font-serif text-3xl font-normal">You’re offline</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        This page hasn’t been saved for offline use yet. Pages and products you’ve already viewed are still
        available, and your bag is kept on this device. Checkout and order details need a connection.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Link href="/" className="btn-primary">
          Home
        </Link>
        <Link href="/cart" className="btn-outline">
          View bag
        </Link>
      </div>
    </div>
  );
}
