export type ArtShape =
  | "beads"
  | "beadbracelet"
  | "jadebeads"
  | "blackbeads"
  | "bracelet"
  | "mala"
  | "mala2"
  | "mala3";

export interface SeedCategory {
  slug: string;
  name: string;
  description: string;
  art: { shape: ArtShape; tone: string };
}

export interface SeedProduct {
  slug: string;
  name: string;
  categorySlug: string;
  priceCents: number;
  description: string;
  art: { shape: ArtShape; tone: string };
}

export const CATEGORIES: SeedCategory[] = [
  {
    slug: "beaded-bracelets",
    name: "Beaded Bracelets",
    description: "Easy stretch bracelets in warm, wearable colorways for everyday stacking.",
    art: { shape: "beadbracelet", tone: "#b99a63" },
  },
  {
    slug: "natural-stone",
    name: "Natural Stone",
    description: "Bracelets strung with natural stone beads, each with its own texture and tone.",
    art: { shape: "jadebeads", tone: "#b99a63" },
  },
  {
    slug: "wood-beads",
    name: "Wood Beads",
    description: "Lightweight wood and sandalwood beads with a soft, natural finish.",
    art: { shape: "beads", tone: "#b99a63" },
  },
  {
    slug: "buddhist-mala",
    name: "Buddhist Mala",
    description: "Traditional-inspired malas for personal ritual, reflection, or gifting.",
    art: { shape: "mala", tone: "#b99a63" },
  },
  {
    slug: "meditation-beads",
    name: "Meditation Beads",
    description: "Counting beads and pocket strands designed for quiet, mindful moments.",
    art: { shape: "mala3", tone: "#b99a63" },
  },
  {
    slug: "mens-bracelets",
    name: "Men’s Bracelets",
    description: "Matte and earthy stone bracelets with a slightly larger, sturdier fit.",
    art: { shape: "blackbeads", tone: "#b99a63" },
  },
  {
    slug: "gift-sets",
    name: "Gift Sets",
    description: "Gift-ready sets, boxed and paired so choosing a present is simple.",
    art: { shape: "bracelet", tone: "#b99a63" },
  },
];

// Prices come from the prototype. The Jade-Tone Bracelet Gift Set was $89 there and is
// normalized to $78 so the whole catalog matches the brief's ~$29–$78 range.
export const PRODUCTS: SeedProduct[] = [
  {
    slug: "green-jade-style-bead-bracelet",
    name: "Green Jade-Style Bead Bracelet",
    categorySlug: "natural-stone",
    priceCents: 4800,
    description:
      "Soft green jade-style beads on a durable stretch cord. A calm, versatile color that pairs with everything from denim to linen.",
    art: { shape: "jadebeads", tone: "#829b78" },
  },
  {
    slug: "tigers-eye-stretch-bracelet",
    name: "Tiger’s Eye Stretch Bracelet",
    categorySlug: "beaded-bracelets",
    priceCents: 3800,
    description:
      "Golden-brown tiger’s eye beads with a natural shimmer. Slips on easily and stacks well with wood or metal pieces.",
    art: { shape: "beadbracelet", tone: "#ad7847" },
  },
  {
    slug: "black-onyx-bead-bracelet",
    name: "Black Onyx Bead Bracelet",
    categorySlug: "natural-stone",
    priceCents: 4200,
    description:
      "Polished black onyx beads for a clean, graphic look. A simple everyday piece that works on its own or in a stack.",
    art: { shape: "blackbeads", tone: "#393a37" },
  },
  {
    slug: "sandalwood-prayer-mala",
    name: "Sandalwood Prayer Mala",
    categorySlug: "buddhist-mala",
    priceCents: 5800,
    description:
      "Warm sandalwood beads strung as a traditional-style prayer mala, finished with a soft tassel.",
    art: { shape: "mala", tone: "#9a6842" },
  },
  {
    slug: "108-bead-sandalwood-mala",
    name: "108-Bead Sandalwood Mala",
    categorySlug: "buddhist-mala",
    priceCents: 7800,
    description:
      "A full 108-bead sandalwood mala with a guru bead, sized to wear as a long necklace or wrap around the wrist.",
    art: { shape: "mala2", tone: "#9b6a45" },
  },
  {
    slug: "smoky-quartz-bead-bracelet",
    name: "Smoky Quartz Bead Bracelet",
    categorySlug: "natural-stone",
    priceCents: 5200,
    description:
      "Translucent smoky quartz beads in muted taupe tones. Understated and easy to wear daily.",
    art: { shape: "beads", tone: "#87776c" },
  },
  {
    slug: "minimal-wood-bead-bracelet",
    name: "Minimal Wood Bead Bracelet",
    categorySlug: "wood-beads",
    priceCents: 2900,
    description:
      "Light, smooth wood beads on a stretch cord. Our most relaxed piece, made for everyday wear.",
    art: { shape: "beadbracelet", tone: "#94633f" },
  },
  {
    slug: "gemstone-meditation-beads",
    name: "Gemstone Meditation Beads",
    categorySlug: "meditation-beads",
    priceCents: 6800,
    description:
      "Mixed natural stone beads strung for counting during meditation or breathing practice.",
    art: { shape: "mala3", tone: "#8b7967" },
  },
  {
    slug: "ocean-blue-bead-bracelet",
    name: "Ocean Blue Bead Bracelet",
    categorySlug: "beaded-bracelets",
    priceCents: 3600,
    description:
      "Cool ocean-blue beads that add a light pop of color. Pairs nicely with silver and white.",
    art: { shape: "beads", tone: "#6f9da5" },
  },
  {
    slug: "matte-obsidian-bracelet",
    name: "Matte Obsidian Bracelet",
    categorySlug: "mens-bracelets",
    priceCents: 4400,
    description:
      "Matte-finished obsidian beads with a sturdy fit. A minimal, dark bracelet for everyday wear.",
    art: { shape: "blackbeads", tone: "#393a37" },
  },
  {
    slug: "warm-sandalwood-beads",
    name: "Warm Sandalwood Beads",
    categorySlug: "wood-beads",
    priceCents: 3400,
    description:
      "Rich sandalwood beads with a gentle natural grain. Simple, warm, and easy to layer.",
    art: { shape: "beads", tone: "#9b6a45" },
  },
  {
    slug: "jade-tone-bracelet-gift-set",
    name: "Jade-Tone Bracelet Gift Set",
    categorySlug: "gift-sets",
    priceCents: 7800,
    description:
      "A boxed pair of jade-tone bead bracelets, ready to give. Demo price normalized from $89 to $78.",
    art: { shape: "jadebeads", tone: "#829b78" },
  },
  {
    slug: "rose-quartz-bead-bracelet",
    name: "Rose Quartz Bead Bracelet",
    categorySlug: "natural-stone",
    priceCents: 4600,
    description:
      "Soft pink rose quartz beads with a gentle sheen. A light, feminine everyday bracelet.",
    art: { shape: "beadbracelet", tone: "#c98f9e" },
  },
  {
    slug: "daily-stack-bracelet-set",
    name: "Daily Stack Bracelet Set",
    categorySlug: "gift-sets",
    priceCents: 6200,
    description:
      "A coordinated set of three bracelets designed to be worn together or split up.",
    art: { shape: "bracelet", tone: "#b99a63" },
  },
  {
    slug: "dark-wood-meditation-mala",
    name: "Dark Wood Meditation Mala",
    categorySlug: "meditation-beads",
    priceCents: 7200,
    description:
      "Deep-toned wood beads strung as a meditation mala with a central marker bead.",
    art: { shape: "mala2", tone: "#68452f" },
  },
  {
    slug: "mens-tiger-eye-bracelet",
    name: "Men’s Tiger Eye Bracelet",
    categorySlug: "mens-bracelets",
    priceCents: 4900,
    description:
      "Larger tiger eye beads with a relaxed fit. Earthy color that works with casual and smart looks.",
    art: { shape: "beadbracelet", tone: "#ad7847" },
  },
  {
    slug: "natural-stone-pocket-beads",
    name: "Natural Stone Pocket Beads",
    categorySlug: "meditation-beads",
    priceCents: 2400,
    description:
      "A short strand of natural stone beads to carry in a pocket or bag. A thoughtful small gift.",
    art: { shape: "beads", tone: "#8b7967" },
  },
  {
    slug: "sandalwood-and-stone-mala",
    name: "Sandalwood & Stone Mala",
    categorySlug: "buddhist-mala",
    priceCents: 8400,
    description:
      "Sandalwood beads accented with natural stone, strung as a limited-edition mala.",
    art: { shape: "mala3", tone: "#9a6842" },
  },
];

export const productImagePath = (slug: string) => `/images/products/${slug}.svg`;
export const categoryImagePath = (slug: string) => `/images/categories/${slug}.svg`;
