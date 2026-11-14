import Link from "next/link";
import { ProductGrid } from "@/components/catalog/ProductCard";
import { categoryImagePath } from "@/data/catalog";
import { listCategories, listProducts } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [categories, products] = await Promise.all([listCategories(), listProducts()]);
  const featured = products.slice(0, 8);

  return (
    <>
      <section className="mx-auto mt-3 max-w-[1240px] px-2.5 sm:mt-4 sm:px-7">
        <div className="hero-bg relative grid min-h-[430px] overflow-hidden text-white md:min-h-[410px] md:grid-cols-[1.1fr_0.9fr] md:items-center">
          <div className="relative z-10 px-6 pt-10 pb-12 sm:px-12 md:py-14">
            <div className="eyebrow mb-4">Everyday style · Natural materials · Meaningful details</div>
            <h1 className="mb-4 max-w-[540px] font-serif text-[42px] leading-[1.05] font-normal sm:text-6xl">
              A little meaning
              <br />
              in every <i>bead.</i>
            </h1>
            <p className="max-w-[400px] text-sm leading-7 text-[#e1e2d9]">
              Natural stone bracelets, wood beads, Buddhist malas and meditation beads — for your
              daily ritual, personal style, or a thoughtful gift.
            </p>
            <Link
              href="#categories"
              className="mt-5 inline-flex min-h-11 items-center bg-[#f6f0e4] px-6 text-[10px] font-semibold tracking-[0.17em] text-jade-800 uppercase"
            >
              Shop the collection ↗
            </Link>
          </div>
          <div className="pointer-events-none absolute -right-14 -bottom-8 grid h-[55%] w-[60%] place-items-center opacity-70 md:static md:h-full md:w-auto md:opacity-100">
            <div className="orbit w-[min(310px,80%)]">
              <div className="gem" />
            </div>
          </div>
        </div>
      </section>

      <section id="categories" className="mx-auto max-w-[1240px] scroll-mt-4 px-4 pt-12 sm:px-7 sm:pt-16">
        <div className="eyebrow mb-2">Find your signature</div>
        <h2 className="font-serif text-[29px] font-normal sm:text-[34px]">Shop by category</h2>
        <p className="mt-1 text-xs text-muted">Bracelets, beads, malas and gifts for every day.</p>
        <ul className="mt-6 grid grid-cols-4 gap-x-2 gap-y-5 sm:gap-3 lg:grid-cols-7">
          {categories.map((c) => (
            <li key={c.id}>
              <Link href={`/category/${c.slug}`} className="group block text-center" data-testid="category-link">
                <div className="grid h-[78px] place-items-center bg-soft transition-transform group-hover:-translate-y-1 sm:h-28">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={categoryImagePath(c.slug)} alt="" className="h-12 w-14 sm:h-16 sm:w-20" />
                </div>
                <span className="mt-2 block text-[10px] leading-tight sm:text-[11px]">{c.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section id="new" className="mx-auto max-w-[1240px] px-4 pt-12 sm:px-7 sm:pt-16">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <div className="eyebrow mb-2">The latest edit</div>
            <h2 className="font-serif text-[29px] font-normal sm:text-[34px]">Curated for you</h2>
            <p className="mt-1 text-xs text-muted">Natural textures, versatile styles, meaningful details.</p>
          </div>
          <Link href="/products" className="border-b border-gold pb-1 text-[10px] tracking-[0.14em] uppercase">
            View all {products.length} ↗
          </Link>
        </div>
        <ProductGrid products={featured} />
      </section>

      <section id="story" className="mx-auto max-w-[1240px] px-4 pt-14 sm:px-7 sm:pt-16">
        <div className="grid bg-soft md:grid-cols-2">
          <div className="grid min-h-[220px] place-items-center bg-[radial-gradient(circle_at_50%_40%,#c9b68b,#7b866f_40%,#384c3c_80%)] md:min-h-[300px]">
            <div className="orbit w-[200px]">
              <div className="gem" />
            </div>
          </div>
          <div className="self-center p-7 sm:p-11">
            <div className="eyebrow mb-3">The JadeAdorn point of view</div>
            <h2 className="font-serif text-[28px] font-normal sm:text-[32px]">Everyday pieces. Personal meaning.</h2>
            <p className="mt-3 text-[13px] leading-7 text-muted">
              Wearable beadwork, natural stone bracelets, wood beads and traditional-inspired malas.
              Whether you are styling a casual outfit, choosing a gift, or building a personal
              meditation ritual, find pieces that feel at home in everyday life.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
