import Link from "next/link";
import { CartButton } from "./CartButton";

export function SiteHeader() {
  return (
    <header className="border-b border-line/70 bg-cream">
      <div className="bg-jade-800 px-3 py-2 text-center text-[10px] tracking-[0.18em] text-white sm:text-[11px]">
        DEMO STORE · FREE SHIPPING · TEST PAYMENTS ONLY
      </div>
      <div className="mx-auto grid max-w-[1240px] grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-4 sm:px-7 sm:py-5">
        <nav aria-label="Primary" className="flex items-center gap-4 text-xs text-muted sm:gap-6">
          <Link href="/products" className="py-2 hover:text-ink">
            Shop
          </Link>
          <Link href="/#categories" className="hidden py-2 hover:text-ink sm:inline">
            Categories
          </Link>
          <Link href="/#story" className="hidden py-2 hover:text-ink md:inline">
            Our Story
          </Link>
        </nav>
        <Link href="/" className="text-center font-serif text-2xl tracking-[0.12em] sm:text-[31px]">
          JadeAdorn
          <small className="mt-0.5 block font-sans text-[7px] tracking-[0.3em] text-muted sm:text-[9px]">
            BEADED JEWELRY · MADE FOR EVERY DAY
          </small>
        </Link>
        <div className="flex justify-end">
          <CartButton />
        </div>
      </div>
    </header>
  );
}
