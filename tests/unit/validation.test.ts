import { describe, expect, it } from "vitest";
import { createMockPaymentProvider } from "@/lib/mock-payment";
import { computeTotals, formatCents } from "@/lib/money";
import { checkoutRequestSchema, customerDetailsSchema } from "@/lib/validation";

const customer = {
  fullName: "Jamie Chen",
  email: "jamie@example.com",
  addressLine1: "123 Main St",
  city: "Boston",
  state: "MA",
  postalCode: "02110",
  country: "US",
};

describe("money", () => {
  it("formats integer cents and totals lines with demo shipping/tax of 0", () => {
    expect(formatCents(2900)).toBe("$29.00");
    expect(computeTotals([{ unitPriceCents: 4800, quantity: 2 }, { unitPriceCents: 5800, quantity: 1 }])).toEqual({
      subtotalCents: 15400,
      shippingCents: 0,
      taxCents: 0,
      totalCents: 15400,
    });
  });
});

describe("validation", () => {
  it("accepts a valid customer and treats an empty address line 2 as absent", () => {
    const parsed = customerDetailsSchema.parse({ ...customer, addressLine2: "  " });
    expect(parsed.addressLine2).toBeUndefined();
  });

  it("validates US ZIP codes and non-US postal codes", () => {
    expect(customerDetailsSchema.safeParse({ ...customer, postalCode: "02110-1234" }).success).toBe(true);
    expect(customerDetailsSchema.safeParse({ ...customer, postalCode: "2110" }).success).toBe(false);
    expect(customerDetailsSchema.safeParse({ ...customer, country: "GB", postalCode: "SW1A 1AA" }).success).toBe(true);
    expect(customerDetailsSchema.safeParse({ ...customer, country: "FR" }).success).toBe(false);
  });

  it("strips client price fields from checkout items", () => {
    const parsed = checkoutRequestSchema.parse({
      idempotencyKey: "abcdefghijklmnop1234",
      customer,
      items: [{ productId: "p1", quantity: 1, priceCents: 1 }],
      payment: { provider: "mock", token: "tok_mock_success" },
    });
    expect(parsed.items[0]).toEqual({ productId: "p1", quantity: 1 });
  });
});

describe("mock payment provider", () => {
  it("approves/declines by test token and replays results for the same idempotency key", async () => {
    const p = createMockPaymentProvider();
    const ok = await p.charge({ amountCents: 100, currency: "USD", token: "tok_mock_success", idempotencyKey: "k1" });
    expect(ok.status).toBe("succeeded");
    const again = await p.charge({ amountCents: 100, currency: "USD", token: "tok_mock_success", idempotencyKey: "k1" });
    expect(again).toEqual(ok);
    const declined = await p.charge({ amountCents: 100, currency: "USD", token: "tok_mock_decline", idempotencyKey: "k2" });
    expect(declined.status).toBe("declined");
  });
});
