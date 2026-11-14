import { NextRequest } from "next/server";
import { afterAll, describe, expect, it } from "vitest";
import { GET as getCategories } from "@/app/api/categories/route";
import { GET as getProduct } from "@/app/api/products/[slug]/route";
import { GET as getProducts } from "@/app/api/products/route";
import { prisma } from "@/lib/db";

afterAll(() => prisma.$disconnect());

const params = <T>(value: T) => ({ params: Promise.resolve(value) });

describe("category queries (2)", () => {
  it("GET /api/categories lists all 7 categories with product counts", async () => {
    const res = await getCategories();
    expect(res.status).toBe(200);
    const { categories } = await res.json();
    expect(categories).toHaveLength(7);
    expect(categories.map((c: { name: string }) => c.name)).toContain("Buddhist Mala");
    const total = categories.reduce((n: number, c: { productCount: number }) => n + c.productCount, 0);
    expect(total).toBe(18);
  });

  it("GET /api/products?category=slug returns only that category", async () => {
    const res = await getProducts(new NextRequest("http://localhost/api/products?category=natural-stone"));
    expect(res.status).toBe(200);
    const { products } = await res.json();
    expect(products).toHaveLength(4);
    for (const p of products) expect(p.category.slug).toBe("natural-stone");
  });

  it("GET /api/products returns all active products", async () => {
    const { products } = await (await getProducts(new NextRequest("http://localhost/api/products"))).json();
    expect(products).toHaveLength(18);
  });

  it("unknown category returns 404 with the unified error shape", async () => {
    const res = await getProducts(new NextRequest("http://localhost/api/products?category=does-not-exist"));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: { code: "NOT_FOUND", message: expect.any(String) } });
  });
});

describe("product detail (3)", () => {
  it("GET /api/products/[slug] returns the product with its category", async () => {
    const res = await getProduct(new Request("http://localhost"), params({ slug: "sandalwood-prayer-mala" }));
    expect(res.status).toBe(200);
    const { product } = await res.json();
    expect(product).toMatchObject({
      name: "Sandalwood Prayer Mala",
      priceCents: 5800,
      currency: "USD",
      category: { slug: "buddhist-mala", name: "Buddhist Mala" },
    });
    expect(product.description.length).toBeGreaterThan(10);
  });

  it("returns 404 for an unknown or inactive product", async () => {
    const res = await getProduct(new Request("http://localhost"), params({ slug: "not-a-product" }));
    expect(res.status).toBe(404);

    await prisma.product.update({ where: { slug: "warm-sandalwood-beads" }, data: { isActive: false } });
    try {
      const inactive = await getProduct(new Request("http://localhost"), params({ slug: "warm-sandalwood-beads" }));
      expect(inactive.status).toBe(404);
    } finally {
      await prisma.product.update({ where: { slug: "warm-sandalwood-beads" }, data: { isActive: true } });
    }
  });
});
