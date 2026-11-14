import { NextResponse } from "next/server";
import { AppError, handleRouteError } from "@/lib/errors";
import { requestLogger } from "@/lib/logger";
import { getOrderByPublicId } from "@/lib/orders";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ publicId: string }> }) {
  try {
    const { publicId } = await params;
    const order = await getOrderByPublicId(publicId);
    if (!order) throw new AppError(404, "NOT_FOUND", "Order not found");
    return NextResponse.json({ order }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return handleRouteError(err, requestLogger("GET /api/orders/[publicId]"));
  }
}
