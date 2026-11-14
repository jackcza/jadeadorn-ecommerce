import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as checkout } from "@/app/api/checkout/route";
import { prisma } from "@/lib/db";
import { createLogger, logger } from "@/lib/logger";
import { checkoutBody, jsonRequest, productBySlug, validCustomer } from "../helpers";

type Line = Record<string, unknown>;

let raw: string[] = [];
const lines = () => raw.map((l) => JSON.parse(l) as Line);
const events = () => lines().map((l) => l.event);

// Route handlers log through `logger.child()`; send those lines to memory with the real configuration.
beforeEach(() => {
  raw = [];
  const capture = createLogger({ level: "debug", destination: { write: (line) => void raw.push(line) } });
  vi.spyOn(logger, "child").mockImplementation((bindings) => capture.child(bindings));
});
afterEach(() => vi.restoreAllMocks());
afterAll(() => prisma.$disconnect());

const post = (body: unknown) => checkout(jsonRequest("http://localhost:3000/api/checkout", body));
const cart = async (slug: string, quantity = 1) => [{ productId: (await productBySlug(slug)).id, quantity }];

describe("checkout logging", () => {
  it("logs started → validated → payment succeeded → order created under one requestId", async () => {
    const res = await post(checkoutBody({ items: await cart("ocean-blue-bead-bracelet", 2) }));
    expect(res.status).toBe(201);
    const { order } = await res.json();
    const row = await prisma.order.findUniqueOrThrow({ where: { publicId: order.publicId } });

    expect(events()).toEqual(["checkout_started", "checkout_validated", "payment_succeeded", "order_created"]);
    const requestId = res.headers.get("x-request-id");
    expect(requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    for (const line of lines()) {
      expect(line).toMatchObject({ requestId, route: "POST /api/checkout", level: expect.any(String) });
      expect(Date.parse(line.timestamp as string)).not.toBeNaN();
    }

    const [, validated, payment, created] = lines();
    expect(validated).toMatchObject({ level: "debug", lineCount: 1, itemCount: 2 });
    expect(payment).toMatchObject({
      level: "info",
      provider: "mock",
      amountCents: order.totalCents,
      currency: "USD",
      durationMs: expect.any(Number),
    });
    expect(created).toMatchObject({
      level: "info",
      orderId: row.id,
      orderNumber: order.orderNumber,
      totalCents: order.totalCents,
      durationMs: expect.any(Number),
    });
  });

  it("logs a declined payment and the failed order at warn level, with no orderId", async () => {
    const res = await post(
      checkoutBody({ items: await cart("ocean-blue-bead-bracelet"), payment: { provider: "mock", token: "tok_mock_decline" } }),
    );
    expect(res.status).toBe(402);
    expect(res.headers.get("x-request-id")).toBe(lines()[0].requestId);

    expect(events()).toEqual(["checkout_started", "checkout_validated", "payment_failed", "order_creation_failed"]);
    const [, , payment, failed] = lines();
    expect(payment).toMatchObject({ level: "warn", reason: "card_declined", amountCents: expect.any(Number) });
    expect(failed).toMatchObject({ level: "warn", errorCode: "PAYMENT_DECLINED", status: 402, durationMs: expect.any(Number) });
    expect(lines().some((l) => "orderId" in l)).toBe(false);
  });

  it("logs a repeated idempotency key as order_replayed, not a second order_created", async () => {
    const body = checkoutBody({ items: await cart("minimal-wood-bead-bracelet") });
    await post(body);
    const firstOrderId = lines().at(-1)?.orderId;
    raw = [];

    const res = await post(body);
    expect(res.status).toBe(200);
    expect(events()).toEqual(["checkout_started", "checkout_validated", "order_replayed"]);
    expect(lines().at(-1)).toMatchObject({ level: "info", orderId: firstOrderId });
  });

  it("logs rejected requests as order_creation_failed without the submitted values", async () => {
    const res = await post(
      checkoutBody({ items: await cart("black-onyx-bead-bracelet"), customer: { ...validCustomer, email: "not-an-email" } }),
    );
    expect(res.status).toBe(400);
    expect(events()).toEqual(["checkout_started", "order_creation_failed"]);
    expect(lines()[1]).toMatchObject({ level: "warn", errorCode: "VALIDATION_ERROR", status: 400 });
    expect(raw.join("")).not.toContain("not-an-email");
  });

  it("logs a database failure after payment as database_error and order_creation_failed at error level", async () => {
    const items = await cart("ocean-blue-bead-bracelet");
    const before = await prisma.order.count();
    // A missing table makes the order transaction fail after the mock charge succeeded.
    await prisma.$executeRawUnsafe('ALTER TABLE "OrderItem" RENAME TO "OrderItem_offline"');
    let res: Response;
    try {
      res = await post(checkoutBody({ items }));
    } finally {
      await prisma.$executeRawUnsafe('ALTER TABLE "OrderItem_offline" RENAME TO "OrderItem"');
    }
    expect(res.status).toBe(500);
    expect(await prisma.order.count()).toBe(before);

    expect(events()).toEqual([
      "checkout_started",
      "checkout_validated",
      "payment_succeeded",
      "database_error",
      "order_creation_failed",
    ]);
    const [, , , dbError, failed] = lines();
    expect(dbError).toMatchObject({ level: "error", errorName: "PrismaClientKnownRequestError", prismaCode: "P2021" });
    expect(failed).toMatchObject({ level: "error", errorCode: "INTERNAL_ERROR", status: 500 });
    expect(raw.join("")).not.toContain(validCustomer.fullName);
  });

  it("never writes customer details, the payment token or values that unlock the order", async () => {
    const body = checkoutBody({ items: await cart("rose-quartz-bead-bracelet") });
    const { order, confirmationUrl } = await (await post(body)).json();
    expect(order.publicId).toBeTruthy();

    const out = raw.join("");
    for (const value of [
      validCustomer.fullName,
      validCustomer.email,
      validCustomer.addressLine1,
      validCustomer.addressLine2,
      validCustomer.city,
      validCustomer.postalCode,
      "tok_mock_success",
      body.idempotencyKey,
      order.publicId,
      confirmationUrl,
    ]) {
      expect(out).not.toContain(value);
    }
  });
});
