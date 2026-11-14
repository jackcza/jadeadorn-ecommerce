import { z } from "zod";

export const MAX_QUANTITY = 10;
export const MAX_LINES = 20;

export const COUNTRIES = [
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "GB", name: "United Kingdom" },
  { code: "AU", name: "Australia" },
] as const;

const countryCodes = COUNTRIES.map((c) => c.code) as [string, ...string[]];

export const MOCK_PAYMENT_TOKENS = ["tok_mock_success", "tok_mock_decline"] as const;
export type MockPaymentToken = (typeof MOCK_PAYMENT_TOKENS)[number];

const text = (label: string, min: number, max: number) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(min, min <= 1 ? `${label} is required` : `${label} must be at least ${min} characters`)
    .max(max, `${label} must be at most ${max} characters`);

/** Customer + shipping fields, shared by the checkout form (client) and the API (server). */
export const customerDetailsSchema = z
  .object({
    fullName: text("Full name", 2, 100),
    email: z
      .string({ error: "Email is required" })
      .trim()
      .max(254, "Email is too long")
      .pipe(z.email("Enter a valid email address")),
    addressLine1: text("Address line 1", 3, 120),
    addressLine2: z
      .string()
      .trim()
      .max(120, "Address line 2 must be at most 120 characters")
      .optional()
      .transform((v) => (v ? v : undefined)),
    city: text("City", 2, 80),
    state: text("State / region", 2, 50),
    postalCode: text("ZIP / postal code", 3, 10),
    country: z.enum(countryCodes, { error: "Choose a supported country" }),
  })
  .superRefine((v, ctx) => {
    if (v.country === "US" && !/^\d{5}(-\d{4})?$/.test(v.postalCode)) {
      ctx.addIssue({
        code: "custom",
        path: ["postalCode"],
        message: "Enter a 5-digit ZIP code (or ZIP+4)",
      });
    } else if (!/^[A-Za-z0-9 -]{3,10}$/.test(v.postalCode)) {
      ctx.addIssue({ code: "custom", path: ["postalCode"], message: "Enter a valid postal code" });
    }
  });

export type CustomerDetails = z.infer<typeof customerDetailsSchema>;
export type CustomerDetailsInput = z.input<typeof customerDetailsSchema>;

export const cartItemSchema = z.object({
  productId: z.string().min(1).max(64),
  quantity: z
    .number()
    .int("Quantity must be a whole number")
    .min(1, "Quantity must be at least 1")
    .max(MAX_QUANTITY, `Quantity must be at most ${MAX_QUANTITY}`),
});

/**
 * POST /api/checkout body. Only product ids and quantities are accepted from the client;
 * any price fields sent by the client are stripped and never used.
 */
export const checkoutRequestSchema = z.object({
  idempotencyKey: z
    .string()
    .min(16, "Invalid idempotency key")
    .max(100, "Invalid idempotency key")
    .regex(/^[A-Za-z0-9_-]+$/, "Invalid idempotency key"),
  customer: customerDetailsSchema,
  items: z
    .array(cartItemSchema)
    .min(1, "Your cart is empty")
    .max(MAX_LINES, `At most ${MAX_LINES} different products per order`),
  payment: z.object({
    provider: z.literal("mock"),
    token: z.enum(MOCK_PAYMENT_TOKENS, { error: "Choose a test payment method" }),
  }),
});

export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;

/** Flattens Zod issues to { "customer.email": "message" } for field-level display. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
