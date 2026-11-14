import type { Metadata } from "next";
import { CategoryNav } from "@/components/catalog/CategoryNav";
import { ProductGrid } from "@/components/catalog/ProductCard";
import { listCategories, listProducts } from "@/lib/catalog";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "All pieces" };

export default async function ProductsPage() {
  const [categories, products] = await Promise.all([listCategories(), listProducts()]);
  return (
    <div className="mx-auto max-w-[1240px] px-4 py-8 sm:px-7 sm:py-12">
      <div className="eyebrow mb-2">The collection</div>
      <h1 className="font-serif text-3xl font-normal sm:text-4xl">All pieces</h1>
      <p className="mt-1 mb-6 text-xs text-muted">{products.length} pieces</p>
      <CategoryNav categories={categories} />
      <div className="mt-6">
        <ProductGrid products={products} />
      </div>
    </div>
  );
}
