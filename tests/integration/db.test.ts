import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { CATEGORIES, PRODUCTS } from "@/data/catalog";
import { prisma } from "@/lib/db";
import { seedCatalog } from "@/lib/seed";

afterAll(() => prisma.$disconnect());

describe("database initialization (1)", () => {
  it("creates the 4 tables and seeds 7 categories and 18 products", async () => {
    expect(await prisma.category.count()).toBe(7);
    expect(await prisma.product.count()).toBe(18);
    // Order tables exist and are queryable.
    await expect(prisma.order.count()).resolves.toBeTypeOf("number");
    await expect(prisma.orderItem.count()).resolves.toBeTypeOf("number");
  });

  it("stores prices as integer cents and normalizes the $89 gift set to $78", async () => {
    const products = await prisma.product.findMany();
    for (const p of products) {
      expect(Number.isInteger(p.priceCents)).toBe(true);
      expect(p.currency).toBe("USD");
      expect(p.imageUrl).toMatch(/^\/images\/products\/.+\.svg$/);
    }
    const giftSet = products.find((p) => p.slug === "jade-tone-bracelet-gift-set");
    expect(giftSet?.priceCents).toBe(7800);
    expect(Math.min(...products.map((p) => p.priceCents))).toBe(2400);
  });

  it("seed is idempotent (re-running does not duplicate rows)", async () => {
    const client = new PrismaClient();
    await seedCatalog(client);
    await client.$disconnect();
    expect(await prisma.category.count()).toBe(CATEGORIES.length);
    expect(await prisma.product.count()).toBe(PRODUCTS.length);
  });
});
