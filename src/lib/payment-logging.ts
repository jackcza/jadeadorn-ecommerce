import { elapsedMs, type Logger } from "./logger";
import type { PaymentProvider } from "./mock-payment";

/** Logs the outcome and duration of each charge. The payment token is deliberately not logged. */
export function withPaymentLogging(provider: PaymentProvider, log: Logger): PaymentProvider {
  return {
    name: provider.name,
    async charge(input) {
      const startedAt = performance.now();
      const result = await provider.charge(input);
      const fields = {
        provider: provider.name,
        amountCents: input.amountCents,
        currency: input.currency,
        durationMs: elapsedMs(startedAt),
      };
      if (result.status === "succeeded") log.info({ event: "payment_succeeded", ...fields }, "Payment succeeded");
      else log.warn({ event: "payment_failed", reason: result.code, ...fields }, "Payment declined");
      return result;
    },
  };
}
