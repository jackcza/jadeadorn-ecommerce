import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCartPanel } from "@/components/catalog/AddToCartPanel";
import { ProductGrid } from "@/components/catalog/ProductCard";
import { getProductBySlug, listRelatedProducts } from "@/lib/catalog";
import { formatCents } from "@/lib/money";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProductBySlug((await params).slug);
  return product
    ? { title: product.name, description: product.description }
    : { title: "Product not found" };
}

export default async function ProductPage({ params }: Props) {
  const product = await getProductBySlug((await params).slug);
  if (!product) notFound();
  const related = await listRelatedProducts(product, 4);

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-6 sm:px-7 sm:py-10">
      <nav aria-label="Breadcrumb" className="mb-5 text-xs text-muted">
        <Link href="/" className="hover:text-ink">
          Home
        </Link>{" "}
        /{" "}
        <Link href={`/category/${product.category.slug}`} className="hover:text-ink">
          {product.category.name}
        </Link>{" "}
        / <span className="text-ink">{product.name}</span>
      </nav>

      <div className="grid gap-7 md:grid-cols-2 md:gap-12">
        <figure className="relative grid aspect-square place-items-center bg-soft">
          {product.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.imageUrl} alt={`${product.name} (placeholder artwork)`} className="h-3/4 w-3/4 object-contain" />
          )}
          <figcaption className="absolute bottom-3 left-3 bg-paper/90 px-2 py-1 text-[9px] tracking-[0.15em] text-muted uppercase">
            Placeholder artwork
          </figcaption>
        </figure>

        <div className="md:pt-4">
          <div className="eyebrow">{product.category.name}</div>
          <h1 className="mt-2 font-serif text-3xl leading-tight font-normal sm:text-4xl">{product.name}</h1>
          <p className="mt-3 text-xl font-semibold" data-testid="detail-price">
            {formatCents(product.priceCents, product.currency)}
          </p>
          <p className="mt-5 text-[15px] leading-7 text-muted">{product.description}</p>
          <AddToCartPanel product={product} />
          <ul className="mt-6 space-y-1.5 border-t border-line pt-5 text-xs text-muted">
            <li>Free demo shipping · Tax not charged in this demo</li>
            <li>Materials and cultural descriptions should be verified before real sale.</li>
          </ul>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-14">
          <h2 className="mb-5 font-serif text-2xl font-normal">You may also like</h2>
          <ProductGrid products={related} />
        </section>
      )}
    </div>
  );
}
