import type { Metadata } from "next";
import { CartView } from "@/components/cart/CartView";

export const metadata: Metadata = { title: "Your bag" };

export default function CartPage() {
  return (
    <div className="mx-auto max-w-[1040px] px-4 py-8 sm:px-7 sm:py-12">
      <h1 className="mb-6 font-serif text-3xl font-normal sm:text-4xl">Your bag</h1>
      <CartView />
    </div>
  );
}
