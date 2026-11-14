import { NextResponse } from "next/server";
import { getProductBySlug } from "@/lib/catalog";
import { AppError, handleRouteError } from "@/lib/errors";
import { requestLogger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const product = /^[a-z0-9-]{1,100}$/.test(slug) ? await getProductBySlug(slug) : null;
    if (!product) throw new AppError(404, "NOT_FOUND", "Product not found");
    return NextResponse.json({ product });
  } catch (err) {
    return handleRouteError(err, requestLogger("GET /api/products/[slug]"));
  }
}
