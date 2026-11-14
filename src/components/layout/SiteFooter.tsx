import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line bg-soft">
      <div className="mx-auto flex max-w-[1240px] flex-wrap justify-between gap-6 px-5 py-9 text-xs text-muted sm:px-7">
        <div className="max-w-sm">
          <strong className="font-serif text-xl font-normal tracking-[0.12em] text-ink">JadeAdorn</strong>
          <p className="mt-2 leading-relaxed">
            Beaded jewelry &amp; everyday accessories. This is a case-study demo: product art is
            placeholder illustration and payments are simulated — no real charges.
          </p>
          <small className="mt-2 block">© 2026 JadeAdorn demo.</small>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-5">
          <Link href="/products" className="py-2 hover:text-ink">
            All pieces
          </Link>
          <Link href="/#story" className="py-2 hover:text-ink">
            Our Story
          </Link>
          <Link href="/cart" className="py-2 hover:text-ink">
            Bag
          </Link>
        </nav>
      </div>
    </footer>
  );
}
