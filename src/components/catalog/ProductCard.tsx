import Link from "next/link";
import type { ProductDTO } from "@/lib/catalog";
import { formatCents } from "@/lib/money";
import { QuickAddButton } from "./QuickAddButton";

export function ProductCard({ product }: { product: ProductDTO }) {
  return (
    <article className="group flex min-w-0 flex-col" data-testid="product-card">
      <Link href={`/products/${product.slug}`} className="block">
        <div className="grid aspect-[4/5] place-items-center bg-soft transition-transform duration-200 group-hover:-translate-y-1 sm:aspect-square">
          {product.imageUrl && (
            // Local SVG placeholders; next/image optimization adds nothing for SVG.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.imageUrl} alt="" className="h-3/4 w-3/4 object-contain" loading="lazy" />
          )}
        </div>
        <div className="pt-3">
          <div className="text-[9px] tracking-[0.15em] text-muted uppercase">{product.category.name}</div>
          <h3 className="mt-1.5 font-serif text-[15px] leading-snug sm:text-[17px]">{product.name}</h3>
        </div>
      </Link>
      <div className="mt-auto flex flex-col gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-sm font-bold">{formatCents(product.priceCents, product.currency)}</span>
        <QuickAddButton product={product} />
      </div>
    </article>
  );
}

export function ProductGrid({ products }: { products: ProductDTO[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-4 md:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}
