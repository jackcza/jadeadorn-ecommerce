import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import type { Logger } from "./logger";

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

const DATABASE_ERRORS = [
  Prisma.PrismaClientKnownRequestError,
  Prisma.PrismaClientUnknownRequestError,
  Prisma.PrismaClientRustPanicError,
  Prisma.PrismaClientInitializationError,
  Prisma.PrismaClientValidationError,
];

const isDatabaseError = (err: unknown): err is Error => DATABASE_ERRORS.some((DbError) => err instanceof DbError);

/** Prisma messages can echo query values such as customer details, so only the class, code and model are kept. */
function databaseErrorFields(err: Error) {
  const known = err instanceof Prisma.PrismaClientKnownRequestError ? err : undefined;
  return {
    errorName: err.name,
    prismaCode: known?.code ?? (err instanceof Prisma.PrismaClientInitializationError ? err.errorCode : undefined),
    model: known?.meta?.modelName,
  };
}

/**
 * Maps a thrown value to the API error response. Expected 4xx AppErrors are not logged here;
 * server errors are logged as `api_error`, or as `database_error` when Prisma threw.
 */
export function handleRouteError(err: unknown, log: Logger) {
  if (err instanceof AppError) {
    if (err.status >= 500) log.error({ event: "api_error", status: err.status, errorCode: err.code }, err.message);
    return errorResponse(err.status, err.code, err.message, err.details);
  }
  if (isDatabaseError(err)) {
    log.error({ event: "database_error", status: 500, ...databaseErrorFields(err) }, "Database error");
  } else {
    log.error({ event: "api_error", status: 500, errorCode: "INTERNAL_ERROR", err }, "Unexpected API error");
  }
  return errorResponse(500, "INTERNAL_ERROR", "Something went wrong. Please try again.");
}
