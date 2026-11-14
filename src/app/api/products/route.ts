import { NextResponse, type NextRequest } from "next/server";
import { getCategory, listProducts } from "@/lib/catalog";
import { AppError, handleRouteError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const category = request.nextUrl.searchParams.get("category") ?? undefined;
    if (category !== undefined) {
      if (!/^[a-z0-9-]{1,64}$/.test(category) || !(await getCategory(category))) {
        throw new AppError(404, "NOT_FOUND", `Category "${category.slice(0, 64)}" not found`);
      }
    }
    return NextResponse.json({ products: await listProducts({ categorySlug: category }) });
  } catch (err) {
    return handleRouteError(err);
  }
}
