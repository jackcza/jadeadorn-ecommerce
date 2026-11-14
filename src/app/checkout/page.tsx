import type { Metadata } from "next";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default function CheckoutPage() {
  return (
    <div className="mx-auto max-w-[1040px] px-4 py-8 sm:px-7 sm:py-12">
      <h1 className="mb-6 font-serif text-3xl font-normal sm:text-4xl">Checkout</h1>
      <CheckoutForm />
    </div>
  );
}
