import { NextResponse } from "next/server";

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "INVALID_JSON"
  | "PAYLOAD_TOO_LARGE"
  | "FORBIDDEN_ORIGIN"
  | "NOT_FOUND"
  | "PRODUCT_UNAVAILABLE"
  | "PAYMENT_DECLINED"
  | "INTERNAL_ERROR";

export interface ApiErrorBody {
  error: { code: ErrorCode; message: string; details?: unknown };
}

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function errorResponse(status: number, code: ErrorCode, message: string, details?: unknown) {
  const body: ApiErrorBody = { error: { code, message, ...(details !== undefined ? { details } : {}) } };
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export function handleRouteError(err: unknown) {
  if (err instanceof AppError) return errorResponse(err.status, err.code, err.message, err.details);
  console.error("[api] unexpected error", err);
  return errorResponse(500, "INTERNAL_ERROR", "Something went wrong. Please try again.");
}
