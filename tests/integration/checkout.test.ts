import { afterAll, describe, expect, it } from "vitest";
import { POST as checkout } from "@/app/api/checkout/route";
import { GET as getOrder } from "@/app/api/orders/[publicId]/route";
import { prisma } from "@/lib/db";
import { checkoutBody, jsonRequest, newKey, productBySlug } from "../helpers";

afterAll(() => prisma.$disconnect());

const URL = "http://localhost:3000/api/checkout";
const post = (body: unknown, headers?: Record<string, string>) => checkout(jsonRequest(URL, body, headers));

async function cartOf(...entries: [slug: string, quantity: number][]) {
  return Promise.all(
    entries.map(async ([slug, quantity]) => ({ productId: (await productBySlug(slug)).id, quantity })),
  );
}

describe("POST /api/checkout — success (5) and persistence (7)", () => {
  it("charges the mock provider, creates a PAID order and returns its public id", async () => {
    const items = await cartOf(["green-jade-style-bead-bracelet", 2], ["sandalwood-prayer-mala", 1]);
    const res = await post(checkoutBody({ items }));
    expect(res.status).toBe(201);
    expect(res.headers.get("cache-control")).toContain("no-store");
    const { order, confirmationUrl, replayed } = await res.json();

    expect(replayed).toBe(false);
    expect(confirmationUrl).toBe(`/orders/${order.publicId}`);
    expect(order.publicId).toMatch(/^[A-Za-z0-9_-]{20,}$/);
    expect(order.orderNumber).toMatch(/^JA-\d{6}-[A-Z2-9]{6}$/);
    expect(order).toMatchObject({
      customerEmail: "jamie@example.com",
      subtotalCents: 2 * 4800 + 5800,
      shippingCents: 0,
      taxCents: 0,
      totalCents: 15400,
      currency: "USD",
      paymentProvider: "mock",
      paymentStatus: "PAID",
      orderStatus: "CONFIRMED",
    });
    expect(order).not.toHaveProperty("id");
    expect(order).not.toHaveProperty("idempotencyKey");
  });

  it("persists Order + OrderItems (name/price snapshots) and serves them via GET /api/orders/[publicId]", async () => {
    const items = await cartOf(["108-bead-sandalwood-mala", 3]);
    const { order } = await (await post(checkoutBody({ items }))).json();

    const row = await prisma.order.findUniqueOrThrow({ where: { publicId: order.publicId }, include: { items: true } });
    expect(row.customerName).toBe("Jamie Chen");
    expect(row.addressLine2).toBe("Apt 4");
    expect(row.items).toHaveLength(1);
    expect(row.items[0]).toMatchObject({
      productName: "108-Bead Sandalwood Mala",
      unitPriceCents: 7800,
      quantity: 3,
      lineTotalCents: 23400,
    });

    // A later price change must not alter the historical order.
    await prisma.product.update({ where: { slug: "108-bead-sandalwood-mala" }, data: { priceCents: 9900 } });
    try {
      const res = await getOrder(new Request("http://localhost"), { params: Promise.resolve({ publicId: order.publicId }) });
      expect(res.status).toBe(200);
      expect(res.headers.get("cache-control")).toContain("no-store");
      const fetched = (await res.json()).order;
      expect(fetched.totalCents).toBe(23400);
      expect(fetched.items[0].unitPriceCents).toBe(7800);
    } finally {
      await prisma.product.update({ where: { slug: "108-bead-sandalwood-mala" }, data: { priceCents: 7800 } });
    }
  });

  it("GET /api/orders/[publicId] returns 404 for unknown ids", async () => {
    const res = await getOrder(new Request("http://localhost"), { params: Promise.resolve({ publicId: "doesNotExist12345" }) });
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("NOT_FOUND");
  });
});

describe("mock payment failure (6)", () => {
  it("returns 402 PAYMENT_DECLINED and writes no order or items", async () => {
    const before = { orders: await prisma.order.count(), items: await prisma.orderItem.count() };
    const items = await cartOf(["ocean-blue-bead-bracelet", 1]);
    const body = checkoutBody({ items, payment: { provider: "mock", token: "tok_mock_decline" } });
    const res = await post(body);

    expect(res.status).toBe(402);
    expect(await res.json()).toMatchObject({ error: { code: "PAYMENT_DECLINED", message: expect.stringMatching(/no charge/i) } });
    expect(await prisma.order.count()).toBe(before.orders);
    expect(await prisma.orderItem.count()).toBe(before.items);
    expect(await prisma.order.findUnique({ where: { idempotencyKey: body.idempotencyKey } })).toBeNull();
  });
});

describe("duplicate submit (8)", () => {
  it("the same idempotency key returns the same order and never creates a second one", async () => {
    const items = await cartOf(["minimal-wood-bead-bracelet", 1]);
    const body = checkoutBody({ items });
    const before = await prisma.order.count();

    const first = await post(body);
    const second = await post(body);
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    const a = await first.json();
    const b = await second.json();
    expect(b.replayed).toBe(true);
    expect(b.order.publicId).toBe(a.order.publicId);
    expect(b.order.orderNumber).toBe(a.order.orderNumber);
    expect(await prisma.order.count()).toBe(before + 1);
  });

  it("concurrent double-clicks with one key still produce exactly one order", async () => {
    const items = await cartOf(["rose-quartz-bead-bracelet", 1]);
    const body = checkoutBody({ items });
    const before = await prisma.order.count();

    const responses = await Promise.all([post(body), post(body), post(body)]);
    const ids = new Set(await Promise.all(responses.map(async (r) => (await r.json()).order.publicId)));
    expect(responses.every((r) => r.status === 200 || r.status === 201)).toBe(true);
    expect(ids.size).toBe(1);
    expect(await prisma.order.count()).toBe(before + 1);
  });
});

describe("server-side price validation (9)", () => {
  it("ignores client-sent prices/totals and reprices from the database", async () => {
    const product = await productBySlug("sandalwood-and-stone-mala");
    const res = await post(
      checkoutBody({
        items: [{ productId: product.id, quantity: 2, priceCents: 1, unitPriceCents: 1 }],
        totalCents: 2,
        subtotalCents: 2,
      }),
    );
    expect(res.status).toBe(201);
    const { order } = await res.json();
    expect(order.items[0].unitPriceCents).toBe(8400);
    expect(order.totalCents).toBe(16800);
  });

  it("rejects unknown or inactive products with 409 PRODUCT_UNAVAILABLE and creates nothing", async () => {
    const before = await prisma.order.count();
    const unknown = await post(checkoutBody({ items: [{ productId: "not-a-real-id", quantity: 1 }] }));
    expect(unknown.status).toBe(409);
    expect((await unknown.json()).error.code).toBe("PRODUCT_UNAVAILABLE");

    await prisma.product.update({ where: { slug: "daily-stack-bracelet-set" }, data: { isActive: false } });
    try {
      const inactive = await post(checkoutBody({ items: await cartOf(["daily-stack-bracelet-set", 1]) }));
      expect(inactive.status).toBe(409);
    } finally {
      await prisma.product.update({ where: { slug: "daily-stack-bracelet-set" }, data: { isActive: true } });
    }
    expect(await prisma.order.count()).toBe(before);
  });

  it("rejects invalid quantities, including duplicates that add up past the limit", async () => {
    const [line] = await cartOf(["black-onyx-bead-bracelet", 1]);
    for (const quantity of [0, -1, 1.5, 11]) {
      const res = await post(checkoutBody({ items: [{ ...line, quantity }] }));
      expect(res.status).toBe(400);
    }
    const merged = await post(checkoutBody({ items: [{ ...line, quantity: 6 }, { ...line, quantity: 6 }] }));
    expect(merged.status).toBe(400);
  });
});

describe("request validation and errors", () => {
  it("returns field-level errors for an invalid customer", async () => {
    const items = await cartOf(["black-onyx-bead-bracelet", 1]);
    const res = await post(
      checkoutBody({
        items,
        customer: { fullName: "J", email: "nope", addressLine1: "", city: "B", state: "", postalCode: "ABC", country: "US" },
      }),
    );
    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(Object.keys(error.details.fields)).toEqual(
      expect.arrayContaining(["customer.fullName", "customer.email", "customer.addressLine1", "customer.city", "customer.state", "customer.postalCode"]),
    );
  });

  it("rejects empty carts, malformed JSON, oversized bodies and cross-origin posts", async () => {
    expect((await post(checkoutBody({ items: [] }))).status).toBe(400);
    const bad = await post("{not json");
    expect(bad.status).toBe(400);
    expect((await bad.json()).error.code).toBe("INVALID_JSON");
    expect((await post("x".repeat(40_000))).status).toBe(413);
    const cross = await post(checkoutBody({ idempotencyKey: newKey() }), { origin: "https://evil.example" });
    expect(cross.status).toBe(403);
  });
});
