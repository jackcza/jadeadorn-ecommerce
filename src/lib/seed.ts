import type { PrismaClient } from "@prisma/client";
import { CATEGORIES, PRODUCTS, productImagePath } from "@/data/catalog";

/** Idempotent: upserts by slug, so re-running never duplicates rows. */
export async function seedCatalog(prisma: PrismaClient) {
  const categoryIds = new Map<string, string>();
  for (const c of CATEGORIES) {
    const row = await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name, description: c.description },
      create: { slug: c.slug, name: c.name, description: c.description },
    });
    categoryIds.set(c.slug, row.id);
  }
  // Staggered createdAt keeps the prototype's product order stable.
  const base = Date.UTC(2026, 0, 1);
  for (const [index, p] of PRODUCTS.entries()) {
    const data = {
      name: p.name,
      description: p.description,
      priceCents: p.priceCents,
      currency: "USD",
      imageUrl: productImagePath(p.slug),
      categoryId: categoryIds.get(p.categorySlug)!,
      isActive: true,
    };
    await prisma.product.upsert({
      where: { slug: p.slug },
      update: data,
      create: { ...data, slug: p.slug, createdAt: new Date(base + index * 60_000) },
    });
  }
  return { categories: CATEGORIES.length, products: PRODUCTS.length };
}
