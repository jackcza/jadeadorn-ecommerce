import { randomBytes } from "node:crypto";
import type { MockPaymentToken } from "./validation";

export type PaymentResult =
  | { status: "succeeded"; reference: string }
  | { status: "declined"; code: "card_declined"; message: string };

export interface PaymentProvider {
  readonly name: string;
  charge(input: {
    amountCents: number;
    currency: string;
    token: MockPaymentToken;
    idempotencyKey: string;
  }): Promise<PaymentResult>;
}

/**
 * TEST PAYMENT — NO REAL CHARGE. Outcome is decided by the test token the shopper picks;
 * no card data is collected. Like Stripe, a repeated idempotency key replays the first result.
 */
export function createMockPaymentProvider(): PaymentProvider {
  const results = new Map<string, PaymentResult>();
  return {
    name: "mock",
    async charge({ amountCents, token, idempotencyKey }) {
      const previous = results.get(idempotencyKey);
      if (previous) return previous;
      let result: PaymentResult;
      if (token === "tok_mock_decline") {
        result = {
          status: "declined",
          code: "card_declined",
          message: "The test card was declined. No charge was made.",
        };
      } else if (!Number.isInteger(amountCents) || amountCents <= 0) {
        result = { status: "declined", code: "card_declined", message: "Invalid amount." };
      } else {
        result = { status: "succeeded", reference: `mock_${randomBytes(9).toString("base64url")}` };
      }
      results.set(idempotencyKey, result);
      if (results.size > 5000) results.delete(results.keys().next().value!);
      return result;
    },
  };
}

const globalForPayments = globalThis as unknown as { mockPayments?: PaymentProvider };
export const mockPaymentProvider =
  globalForPayments.mockPayments ?? (globalForPayments.mockPayments = createMockPaymentProvider());
