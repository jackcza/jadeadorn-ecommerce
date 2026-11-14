import { NextResponse } from "next/server";
import { AppError, handleRouteError } from "@/lib/errors";
import { elapsedMs, newRequestId, requestLogger } from "@/lib/logger";
import { mockPaymentProvider } from "@/lib/mock-payment";
import { placeOrder, type PlaceOrderResult } from "@/lib/orders";
import { withPaymentLogging } from "@/lib/payment-logging";
import { checkoutRequestSchema, fieldErrors, type CheckoutRequest } from "@/lib/validation";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 32 * 1024;

function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    originHost = "";
  }
  if (!host || originHost !== host) {
    throw new AppError(403, "FORBIDDEN_ORIGIN", "Cross-origin checkout requests are not allowed");
  }
}

async function readCheckoutRequest(request: Request): Promise<CheckoutRequest> {
  assertSameOrigin(request);

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    throw new AppError(413, "PAYLOAD_TOO_LARGE", "Request body is too large");
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new AppError(400, "INVALID_JSON", "Request body must be valid JSON");
  }

  const parsed = checkoutRequestSchema.safeParse(json);
  if (!parsed.success) {
    throw new AppError(400, "VALIDATION_ERROR", "Please correct the highlighted fields", {
      fields: fieldErrors(parsed.error),
    });
  }
  return parsed.data;
}

export async function POST(request: Request) {
  const startedAt = performance.now();
  const requestId = newRequestId();
  const log = requestLogger("POST /api/checkout", requestId);
  log.info({ event: "checkout_started" }, "Checkout started");

  let result: PlaceOrderResult;
  try {
    const input = await readCheckoutRequest(request);
    log.debug(
      {
        event: "checkout_validated",
        lineCount: input.items.length,
        itemCount: input.items.reduce((n, i) => n + i.quantity, 0),
      },
      "Checkout request validated",
    );
    result = await placeOrder(input, withPaymentLogging(mockPaymentProvider, log));
  } catch (err) {
    const response = handleRouteError(err, log);
    log[response.status >= 500 ? "error" : "warn"](
      {
        event: "order_creation_failed",
        status: response.status,
        errorCode: err instanceof AppError ? err.code : "INTERNAL_ERROR",
        durationMs: elapsedMs(startedAt),
      },
      "Order creation failed",
    );
    response.headers.set("X-Request-Id", requestId);
    return response;
  }

  const { order, orderId, replayed } = result;
  log.info(
    {
      event: replayed ? "order_replayed" : "order_created",
      orderId,
      orderNumber: order.orderNumber,
      totalCents: order.totalCents,
      currency: order.currency,
      durationMs: elapsedMs(startedAt),
    },
    replayed ? "Existing order returned for a repeated idempotency key" : "Order created",
  );
  return NextResponse.json(
    { order, replayed, confirmationUrl: `/orders/${order.publicId}` },
    { status: replayed ? 200 : 201, headers: { "Cache-Control": "no-store", "X-Request-Id": requestId } },
  );
}
