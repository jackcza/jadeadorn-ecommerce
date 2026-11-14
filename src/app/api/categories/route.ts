import { NextResponse } from "next/server";
import { listCategories } from "@/lib/catalog";
import { handleRouteError } from "@/lib/errors";
import { requestLogger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ categories: await listCategories() });
  } catch (err) {
    return handleRouteError(err, requestLogger("GET /api/categories"));
  }
}
