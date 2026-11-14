import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { artSvg } from "../src/data/art";
import { CATEGORIES, PRODUCTS } from "../src/data/catalog";

const root = join(__dirname, "..", "public", "images");
mkdirSync(join(root, "products"), { recursive: true });
mkdirSync(join(root, "categories"), { recursive: true });

for (const p of PRODUCTS) {
  writeFileSync(
    join(root, "products", `${p.slug}.svg`),
    artSvg(p.art.shape, p.art.tone, `${p.name} placeholder illustration`),
  );
}
for (const c of CATEGORIES) {
  writeFileSync(
    join(root, "categories", `${c.slug}.svg`),
    artSvg(c.art.shape, c.art.tone, `${c.name} placeholder illustration`),
  );
}
console.log(`Wrote ${PRODUCTS.length} product and ${CATEGORIES.length} category SVGs`);
