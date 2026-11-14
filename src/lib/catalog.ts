import { prisma } from "./db";

export interface CategoryDTO {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  productCount: number;
}

export interface ProductDTO {
  id: string;
  name: string;
  slug: string;
  description: string;
  priceCents: number;
  currency: string;
  imageUrl: string | null;
  category: { name: string; slug: string };
}

const productSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  priceCents: true,
  currency: true,
  imageUrl: true,
  category: { select: { name: true, slug: true } },
} as const;

export async function listCategories(): Promise<CategoryDTO[]> {
  const rows = await prisma.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { products: { where: { isActive: true } } } } },
  });
  return rows
    .map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      productCount: c._count.products,
    }))
    .sort((a, b) => CATEGORY_ORDER.indexOf(a.slug) - CATEGORY_ORDER.indexOf(b.slug));
}

const CATEGORY_ORDER = [
  "beaded-bracelets",
  "natural-stone",
  "wood-beads",
  "buddhist-mala",
  "meditation-beads",
  "mens-bracelets",
  "gift-sets",
];

export async function getCategory(slug: string) {
  return prisma.category.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true, description: true },
  });
}

export async function listProducts(opts: { categorySlug?: string } = {}): Promise<ProductDTO[]> {
  return prisma.product.findMany({
    where: {
      isActive: true,
      ...(opts.categorySlug ? { category: { slug: opts.categorySlug } } : {}),
    },
    orderBy: { createdAt: "asc" },
    select: productSelect,
  });
}

export async function getProductBySlug(slug: string): Promise<ProductDTO | null> {
  return prisma.product.findFirst({ where: { slug, isActive: true }, select: productSelect });
}

export async function listRelatedProducts(product: ProductDTO, take = 4): Promise<ProductDTO[]> {
  return prisma.product.findMany({
    where: { isActive: true, category: { slug: product.category.slug }, NOT: { id: product.id } },
    orderBy: { createdAt: "asc" },
    take,
    select: productSelect,
  });
}
