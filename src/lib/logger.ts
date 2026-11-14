import { randomUUID } from "node:crypto";
import pino, { type DestinationStream, type LoggerOptions } from "pino";

/** Accepted LOG_LEVEL values (case-insensitive); `silent` turns logging off. */
export const LOG_LEVELS = ["debug", "info", "warn", "error", "silent"] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export type LogEvent =
  | "checkout_started"
  | "checkout_validated"
  | "payment_succeeded"
  | "payment_failed"
  | "order_created"
  | "order_replayed"
  | "order_creation_failed"
  | "api_error"
  | "database_error";

export interface LogFields {
  event: LogEvent;
  [field: string]: unknown;
}

type LogMethod = (fields: LogFields, msg?: string) => void;

/** The logging surface the app uses: four levels, structured fields first, every line names its event. */
export interface Logger {
  debug: LogMethod;
  info: LogMethod;
  warn: LogMethod;
  error: LogMethod;
  child(bindings: Record<string, unknown>): Logger;
}

const SENSITIVE_KEYS = [
  // Credentials and sessions
  "authorization", "Authorization", "cookie", "Cookie", "set-cookie", "password", "token",
  // Payment data
  "payment", "card", "cardNumber", "cvc",
  // Customer details and the shipping address
  "customer", "fullName", "customerName", "email", "customerEmail", "phone",
  "address", "addressLine1", "addressLine2", "city", "postalCode",
  // Each of these is enough to read an order, including the customer's details
  "idempotencyKey", "publicId", "confirmationUrl",
];

/** Each key is censored at the top level and up to two levels down (e.g. `req.headers.cookie`). */
export const REDACT_PATHS = SENSITIVE_KEYS.flatMap((key) => [`["${key}"]`, `*["${key}"]`, `*.*["${key}"]`]);

/** Unknown or empty values fall back to `info` in production and `debug` otherwise. */
export function resolveLogLevel(value: string | undefined, nodeEnv = process.env.NODE_ENV): LogLevel {
  const level = value?.trim().toLowerCase();
  return LOG_LEVELS.find((l) => l === level) ?? (nodeEnv === "production" ? "info" : "debug");
}

export interface CreateLoggerOptions {
  /** Raw LOG_LEVEL value; defaults to the environment variable. */
  level?: string;
  /** Receives the JSON lines instead of stdout (used by tests). */
  destination?: DestinationStream;
}

export function createLogger({ level = process.env.LOG_LEVEL, destination }: CreateLoggerOptions = {}): Logger {
  const options: LoggerOptions = {
    level: resolveLogLevel(level),
    base: { service: "jadeadorn" },
    timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
    formatters: { level: (label) => ({ level: label }) },
    redact: { paths: REDACT_PATHS, censor: "[REDACTED]" },
  };
  if (destination) return pino(options, destination);
  if (process.env.NODE_ENV === "development") {
    // pino-pretty is a devDependency, so it must only be resolved in development.
    return pino({
      ...options,
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          singleLine: true,
          timestampKey: "timestamp",
          translateTime: "SYS:HH:MM:ss.l",
          ignore: "service",
        },
      },
    });
  }
  return pino(options);
}

const globalForLogger = globalThis as unknown as { logger?: Logger };

/** Reused across dev hot reloads, so a reload does not start another pino-pretty worker. */
export const logger: Logger = globalForLogger.logger ?? (globalForLogger.logger = createLogger());

export const newRequestId = () => randomUUID();

/** Child logger for one API request: every line it writes carries `requestId` and `route`. */
export function requestLogger(route: string, requestId = newRequestId()): Logger {
  return logger.child({ requestId, route });
}

/** Whole milliseconds since `start`, a `performance.now()` reading. */
export const elapsedMs = (start: number) => Math.round(performance.now() - start);
