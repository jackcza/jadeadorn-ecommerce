import { PrismaClient } from "@prisma/client";
import { seedCatalog } from "../src/lib/seed";

const prisma = new PrismaClient();

seedCatalog(prisma)
  .then(({ categories, products }) => {
    console.log(`Seeded ${categories} categories and ${products} products`);
  })
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
