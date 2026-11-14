import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";

export const validCustomer = {
  fullName: "Jamie Chen",
  email: "jamie@example.com",
  addressLine1: "123 Main St",
  addressLine2: "Apt 4",
  city: "Boston",
  state: "MA",
  postalCode: "02110",
  country: "US",
};

export const newKey = () => `test_${randomUUID().replace(/-/g, "")}`;

export async function productBySlug(slug: string) {
  return prisma.product.findUniqueOrThrow({ where: { slug } });
}

export function checkoutBody(overrides: Record<string, unknown> = {}) {
  return {
    idempotencyKey: newKey(),
    customer: validCustomer,
    items: [] as { productId: string; quantity: number; [k: string]: unknown }[],
    payment: { provider: "mock", token: "tok_mock_success" },
    ...overrides,
  };
}

export function jsonRequest(url: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", host: "localhost:3000", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}
