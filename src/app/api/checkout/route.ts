import { NextResponse } from "next/server";
import { AppError, errorResponse, handleRouteError } from "@/lib/errors";
import { placeOrder } from "@/lib/orders";
import { checkoutRequestSchema, fieldErrors } from "@/lib/validation";

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

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);

    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) {
      return errorResponse(413, "PAYLOAD_TOO_LARGE", "Request body is too large");
    }
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON");
    }

    const parsed = checkoutRequestSchema.safeParse(json);
    if (!parsed.success) {
      return errorResponse(400, "VALIDATION_ERROR", "Please correct the highlighted fields", {
        fields: fieldErrors(parsed.error),
      });
    }

    const { order, replayed } = await placeOrder(parsed.data);
    return NextResponse.json(
      { order, replayed, confirmationUrl: `/orders/${order.publicId}` },
      { status: replayed ? 200 : 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
