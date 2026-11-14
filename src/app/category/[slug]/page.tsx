import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CategoryNav } from "@/components/catalog/CategoryNav";
import { ProductGrid } from "@/components/catalog/ProductCard";
import { getCategory, listCategories, listProducts } from "@/lib/catalog";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const category = await getCategory((await params).slug);
  return { title: category?.name ?? "Category not found" };
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  const category = await getCategory(slug);
  if (!category) notFound();
  const [categories, products] = await Promise.all([listCategories(), listProducts({ categorySlug: slug })]);

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-8 sm:px-7 sm:py-12">
      <nav aria-label="Breadcrumb" className="mb-4 text-xs text-muted">
        <Link href="/" className="hover:text-ink">
          Home
        </Link>{" "}
        / <span className="text-ink">{category.name}</span>
      </nav>
      <h1 className="font-serif text-3xl font-normal sm:text-4xl">{category.name}</h1>
      {category.description && <p className="mt-2 max-w-xl text-sm text-muted">{category.description}</p>}
      <p className="mt-1 mb-6 text-xs text-muted" data-testid="category-count">
        {products.length} {products.length === 1 ? "piece" : "pieces"}
      </p>
      <CategoryNav categories={categories} active={slug} />
      <div className="mt-6">
        {products.length ? (
          <ProductGrid products={products} />
        ) : (
          <div className="border border-dashed border-line p-10 text-center text-sm text-muted">
            No pieces are available in this category yet.{" "}
            <Link href="/products" className="text-jade-700 underline">
              Browse all pieces
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
