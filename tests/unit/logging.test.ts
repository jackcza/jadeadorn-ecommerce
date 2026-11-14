import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { AppError, handleRouteError } from "@/lib/errors";
import { createLogger, resolveLogLevel } from "@/lib/logger";

type Line = Record<string, unknown>;

/** A logger with the app's real configuration that writes its JSON lines into memory. */
function captureLogger(level = "debug") {
  const raw: string[] = [];
  const log = createLogger({ level, destination: { write: (line) => void raw.push(line) } });
  return { log, raw, lines: () => raw.map((l) => JSON.parse(l) as Line) };
}

describe("log levels", () => {
  it("reads DEBUG, INFO, WARN and ERROR from LOG_LEVEL in any case", () => {
    expect(["DEBUG", "Info", " warn ", "error", "silent"].map((v) => resolveLogLevel(v))).toEqual([
      "debug",
      "info",
      "warn",
      "error",
      "silent",
    ]);
  });

  it("falls back to info in production and debug elsewhere for missing or unknown values", () => {
    expect(resolveLogLevel(undefined, "production")).toBe("info");
    expect(resolveLogLevel("verbose", "production")).toBe("info");
    expect(resolveLogLevel("", "development")).toBe("debug");
  });

  it("drops lines below the configured level", () => {
    const { log, lines } = captureLogger("WARN");
    log.debug({ event: "checkout_validated" });
    log.info({ event: "checkout_started" });
    log.warn({ event: "payment_failed" });
    log.error({ event: "api_error" });
    expect(lines().map((l) => `${l.level}:${l.event}`)).toEqual(["warn:payment_failed", "error:api_error"]);
  });
});

describe("log format", () => {
  it("writes one JSON object per line with level, timestamp, event and request bindings", () => {
    const { log, raw, lines } = captureLogger();
    log.child({ requestId: "req_1" }).info({ event: "order_created", orderId: "ord_1", durationMs: 12 }, "Order created");

    expect(raw).toHaveLength(1);
    expect(raw[0].endsWith("\n")).toBe(true);
    const [line] = lines();
    expect(line).toMatchObject({
      level: "info",
      service: "jadeadorn",
      requestId: "req_1",
      event: "order_created",
      orderId: "ord_1",
      durationMs: 12,
      msg: "Order created",
    });
    expect(new Date(line.timestamp as string).toISOString()).toBe(line.timestamp);
  });
});

describe("redaction", () => {
  it("censors credentials, payment data, customer details and values that unlock an order", () => {
    const { log, raw, lines } = captureLogger();
    log.error({
      event: "api_error",
      password: "hunter2",
      headers: { authorization: "Bearer secret-token", cookie: "sid=top-cookie" },
      req: { headers: { cookie: "sid=nested-cookie", "set-cookie": "sid=set-cookie-value" } },
      body: {
        idempotencyKey: "ck_secret_key",
        customer: { fullName: "Jamie Chen", email: "jamie@example.com" },
        payment: { provider: "mock", token: "tok_mock_success" },
      },
      order: {
        publicId: "pub_secret",
        customerEmail: "jamie@example.com",
        addressLine1: "123 Main St",
        postalCode: "02110",
        totalCents: 4800,
      },
    });

    for (const secret of [
      "hunter2",
      "secret-token",
      "top-cookie",
      "nested-cookie",
      "set-cookie-value",
      "ck_secret_key",
      "Jamie Chen",
      "jamie@example.com",
      "tok_mock_success",
      "pub_secret",
      "123 Main St",
      "02110",
    ]) {
      expect(raw[0]).not.toContain(secret);
    }
    const [line] = lines();
    expect(line.password).toBe("[REDACTED]");
    expect((line.order as Line).totalCents).toBe(4800);
  });
});

describe("API error logging", () => {
  it("returns expected 4xx errors without logging them", () => {
    const { log, raw } = captureLogger();
    expect(handleRouteError(new AppError(404, "NOT_FOUND", "Product not found"), log).status).toBe(404);
    expect(raw).toHaveLength(0);
  });

  it("logs unexpected errors as api_error with the stack, and answers with a generic 500", async () => {
    const { log, lines } = captureLogger();
    const res = handleRouteError(new TypeError("boom"), log);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." } });

    const [line] = lines();
    expect(line).toMatchObject({ level: "error", event: "api_error", status: 500, err: { type: "TypeError", message: "boom" } });
    expect((line.err as Line).stack).toContain("TypeError: boom");
  });

  it("logs Prisma failures as database_error with the code and model, never the message", () => {
    const { log, raw, lines } = captureLogger();
    const clientVersion = Prisma.prismaVersion.client;
    const known = new Prisma.PrismaClientKnownRequestError("Unique constraint failed for jamie@example.com", {
      code: "P2002",
      clientVersion,
      meta: { modelName: "Order" },
    });
    const invalid = new Prisma.PrismaClientValidationError('Invalid `prisma.order.create()`: { customerName: "Jamie Chen" }', {
      clientVersion,
    });
    expect(handleRouteError(known, log).status).toBe(500);
    expect(handleRouteError(invalid, log).status).toBe(500);

    expect(lines()).toMatchObject([
      { level: "error", event: "database_error", errorName: "PrismaClientKnownRequestError", prismaCode: "P2002", model: "Order" },
      { level: "error", event: "database_error", errorName: "PrismaClientValidationError" },
    ]);
    expect(raw.join("")).not.toMatch(/jamie|customerName/i);
  });
});
