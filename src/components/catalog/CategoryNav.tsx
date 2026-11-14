import Link from "next/link";
import type { CategoryDTO } from "@/lib/catalog";

export function CategoryNav({ categories, active }: { categories: CategoryDTO[]; active?: string }) {
  const base = "shrink-0 border px-4 py-2.5 text-xs whitespace-nowrap transition-colors";
  const on = "border-jade-700 bg-jade-700 text-white";
  const off = "border-line bg-paper hover:border-jade-700";
  return (
    <nav aria-label="Categories" className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
      <ul className="flex gap-2 sm:flex-wrap">
        <li>
          <Link href="/products" className={`${base} ${!active ? on : off} inline-block`} aria-current={!active ? "page" : undefined}>
            All
          </Link>
        </li>
        {categories.map((c) => (
          <li key={c.id}>
            <Link
              href={`/category/${c.slug}`}
              className={`${base} ${active === c.slug ? on : off} inline-block`}
              aria-current={active === c.slug ? "page" : undefined}
            >
              {c.name} <span className="opacity-60">({c.productCount})</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
