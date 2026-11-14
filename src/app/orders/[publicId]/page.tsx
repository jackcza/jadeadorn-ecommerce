import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatCents } from "@/lib/money";
import { getOrderByPublicId } from "@/lib/orders";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Order confirmation", robots: { index: false, follow: false } };

type Props = { params: Promise<{ publicId: string }> };

const statusLabel: Record<string, string> = { PAID: "Paid (test)", CONFIRMED: "Confirmed" };

export default async function OrderConfirmationPage({ params }: Props) {
  const order = await getOrderByPublicId((await params).publicId);
  if (!order) notFound();
  const date = new Date(order.createdAt);

  return (
    <div className="mx-auto max-w-[760px] px-4 py-8 sm:px-7 sm:py-12" data-testid="order-confirmation">
      <div className="text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-jade-700 text-2xl text-white" aria-hidden>
          ✓
        </div>
        <h1 className="mt-4 font-serif text-3xl font-normal sm:text-4xl">Thank you, your order is confirmed</h1>
        <p className="mt-2 text-sm text-muted">
          A confirmation would be sent to <strong className="text-ink" data-testid="order-email">{order.customerEmail}</strong> (emails are not sent in this demo).
        </p>
      </div>

      <div className="mt-8 border border-line bg-paper">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-4 border-b border-line p-5 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-muted">Order number</dt>
            <dd className="mt-1 font-semibold" data-testid="order-number">
              {order.orderNumber}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Order date</dt>
            <dd className="mt-1">
              <time dateTime={order.createdAt}>
                {date.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC
              </time>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Payment status</dt>
            <dd className="mt-1 font-semibold text-jade-700" data-testid="payment-status">
              {statusLabel[order.paymentStatus] ?? order.paymentStatus}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Order status</dt>
            <dd className="mt-1 font-semibold" data-testid="order-status">
              {statusLabel[order.orderStatus] ?? order.orderStatus}
            </dd>
          </div>
        </dl>

        <table className="w-full text-sm">
          <caption className="sr-only">Items in this order</caption>
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th scope="col" className="px-5 py-3 font-normal">Product</th>
              <th scope="col" className="px-2 py-3 text-center font-normal">Qty</th>
              <th scope="col" className="px-5 py-3 text-right font-normal">Total</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((i) => (
              <tr key={i.productId} className="border-b border-line" data-testid="order-item">
                <td className="px-5 py-3">
                  {i.productName}
                  <div className="text-xs text-muted">{formatCents(i.unitPriceCents, order.currency)} each</div>
                </td>
                <td className="px-2 py-3 text-center">{i.quantity}</td>
                <td className="px-5 py-3 text-right">{formatCents(i.lineTotalCents, order.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="space-y-1.5 p-5 text-sm">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd>{formatCents(order.subtotalCents, order.currency)}</dd>
          </div>
          <div className="flex justify-between text-muted">
            <dt>Shipping</dt>
            <dd>{formatCents(order.shippingCents, order.currency)}</dd>
          </div>
          <div className="flex justify-between text-muted">
            <dt>Tax</dt>
            <dd>{formatCents(order.taxCents, order.currency)}</dd>
          </div>
          <div className="flex justify-between border-t border-line pt-2 text-base font-semibold">
            <dt>Total</dt>
            <dd data-testid="order-total">{formatCents(order.totalCents, order.currency)}</dd>
          </div>
        </dl>
        <p className="border-t border-line px-5 py-3 text-xs text-muted">
          Paid with the mock payment provider — TEST PAYMENT, NO REAL CHARGE. Keep this page’s link to view your order again.
        </p>
      </div>

      <div className="mt-8 text-center">
        <Link href="/products" className="btn-outline">
          Continue shopping
        </Link>
      </div>
    </div>
  );
}
