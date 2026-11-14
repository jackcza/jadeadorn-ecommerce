export function formatCents(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

export interface PricedLine {
  unitPriceCents: number;
  quantity: number;
}

// Demo assumption: shipping and tax are always 0 (documented in README).
export const SHIPPING_CENTS = 0;
export const TAX_CENTS = 0;

export function computeTotals(lines: PricedLine[]) {
  const subtotalCents = lines.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0);
  const shippingCents = SHIPPING_CENTS;
  const taxCents = TAX_CENTS;
  return {
    subtotalCents,
    shippingCents,
    taxCents,
    totalCents: subtotalCents + shippingCents + taxCents,
  };
}
