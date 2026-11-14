import { randomBytes, randomInt } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { AppError } from "./errors";
import { computeTotals } from "./money";
import { mockPaymentProvider, type PaymentProvider } from "./mock-payment";
import type { CheckoutRequest } from "./validation";
import { MAX_QUANTITY } from "./validation";

export interface PublicOrder {
  publicId: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  items: {
    productId: string;
    productName: string;
    unitPriceCents: number;
    quantity: number;
    lineTotalCents: number;
  }[];
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  currency: string;
  paymentProvider: string;
  paymentStatus: string;
  orderStatus: string;
  createdAt: string;
}

const orderInclude = { items: { orderBy: { id: "asc" } } } as const;
type OrderWithItems = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

// Internal id, idempotency key and shipping address are intentionally not exposed.
export function toPublicOrder(o: OrderWithItems): PublicOrder {
  return {
    publicId: o.publicId,
    orderNumber: o.orderNumber,
    customerName: o.customerName,
    customerEmail: o.customerEmail,
    items: o.items.map((i) => ({
      productId: i.productId,
      productName: i.productName,
      unitPriceCents: i.unitPriceCents,
      quantity: i.quantity,
      lineTotalCents: i.lineTotalCents,
    })),
    subtotalCents: o.subtotalCents,
    shippingCents: o.shippingCents,
    taxCents: o.taxCents,
    totalCents: o.totalCents,
    currency: o.currency,
    paymentProvider: o.paymentProvider,
    paymentStatus: o.paymentStatus,
    orderStatus: o.orderStatus,
    createdAt: o.createdAt.toISOString(),
  };
}

export async function getOrderByPublicId(publicId: string): Promise<PublicOrder | null> {
  if (!/^[A-Za-z0-9_-]{10,64}$/.test(publicId)) return null;
  const order = await prisma.order.findUnique({ where: { publicId }, include: orderInclude });
  return order ? toPublicOrder(order) : null;
}

const newPublicId = () => randomBytes(18).toString("base64url");
const ORDER_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function newOrderNumber(now = new Date()) {
  const ymd = now.toISOString().slice(2, 10).replace(/-/g, "");
  const suffix = Array.from({ length: 6 }, () => ORDER_ALPHABET[randomInt(ORDER_ALPHABET.length)]).join("");
  return `JA-${ymd}-${suffix}`;
}

function isUniqueViolation(err: unknown, field?: string) {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2002") return false;
  if (!field) return true;
  const target = (err.meta as { target?: string[] | string } | undefined)?.target;
  return Array.isArray(target) ? target.includes(field) : String(target ?? "").includes(field);
}

/** Merge duplicate product lines so the same product cannot dodge the per-line quantity cap. */
function normalizeItems(items: CheckoutRequest["items"]) {
  const merged = new Map<string, number>();
  for (const i of items) merged.set(i.productId, (merged.get(i.productId) ?? 0) + i.quantity);
  for (const [productId, quantity] of merged) {
    if (quantity > MAX_QUANTITY) {
      throw new AppError(400, "VALIDATION_ERROR", `Quantity must be at most ${MAX_QUANTITY}`, {
        fields: { items: `Too many units of product ${productId}` },
      });
    }
  }
  return [...merged].map(([productId, quantity]) => ({ productId, quantity }));
}

export interface PlaceOrderResult {
  order: PublicOrder;
  /** true when the idempotency key was already used and the existing order is returned. */
  replayed: boolean;
}

/**
 * Validated checkout: reprice from the database, charge the mock provider, then persist the
 * order and its items in one transaction. A declined payment throws and writes nothing.
 */
export async function placeOrder(
  input: CheckoutRequest,
  payments: PaymentProvider = mockPaymentProvider,
): Promise<PlaceOrderResult> {
  const existing = await prisma.order.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    include: orderInclude,
  });
  if (existing) return { order: toPublicOrder(existing), replayed: true };

  const items = normalizeItems(input.items);
  const products = await prisma.product.findMany({
    where: { id: { in: items.map((i) => i.productId) }, isActive: true },
    select: { id: true, name: true, priceCents: true, currency: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  const missing = items.filter((i) => !byId.has(i.productId)).map((i) => i.productId);
  if (missing.length) {
    throw new AppError(
      409,
      "PRODUCT_UNAVAILABLE",
      "Some items in your cart are no longer available. Please review your cart.",
      { productIds: missing },
    );
  }

  const lines = items.map((i) => {
    const p = byId.get(i.productId)!;
    return {
      productId: p.id,
      productName: p.name,
      unitPriceCents: p.priceCents,
      quantity: i.quantity,
      lineTotalCents: p.priceCents * i.quantity,
    };
  });
  const totals = computeTotals(lines);
  const currency = "USD";

  const payment = await payments.charge({
    amountCents: totals.totalCents,
    currency,
    token: input.payment.token,
    idempotencyKey: input.idempotencyKey,
  });
  if (payment.status !== "succeeded") {
    throw new AppError(402, "PAYMENT_DECLINED", payment.message, { reason: payment.code });
  }

  const c = input.customer;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const order = await prisma.$transaction(async (tx) => {
        const created = await tx.order.create({
          data: {
            publicId: newPublicId(),
            orderNumber: newOrderNumber(),
            idempotencyKey: input.idempotencyKey,
            customerName: c.fullName,
            customerEmail: c.email.toLowerCase(),
            addressLine1: c.addressLine1,
            addressLine2: c.addressLine2 ?? null,
            city: c.city,
            state: c.state,
            postalCode: c.postalCode,
            country: c.country,
            ...totals,
            currency,
            paymentProvider: payments.name,
            paymentStatus: "PAID",
            orderStatus: "CONFIRMED",
          },
        });
        await tx.orderItem.createMany({ data: lines.map((l) => ({ ...l, orderId: created.id })) });
        return tx.order.findUniqueOrThrow({ where: { id: created.id }, include: orderInclude });
      });
      return { order: toPublicOrder(order), replayed: false };
    } catch (err) {
      if (isUniqueViolation(err, "idempotencyKey")) {
        // A concurrent duplicate submit won the race; return its order instead of a second one.
        const winner = await prisma.order.findUniqueOrThrow({
          where: { idempotencyKey: input.idempotencyKey },
          include: orderInclude,
        });
        return { order: toPublicOrder(winner), replayed: true };
      }
      if (isUniqueViolation(err)) continue;
      throw err;
    }
  }
  throw new AppError(500, "INTERNAL_ERROR", "Could not allocate an order number. Please retry.");
}
