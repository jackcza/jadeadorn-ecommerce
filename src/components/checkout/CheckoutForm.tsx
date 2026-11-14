"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useCart } from "@/components/cart/CartProvider";
import { formatCents } from "@/lib/money";
import { useOnlineStatus } from "@/lib/use-online-status";
import {
  COUNTRIES,
  customerDetailsSchema,
  fieldErrors,
  type CustomerDetailsInput,
  type MockPaymentToken,
} from "@/lib/validation";

const KEY_STORAGE = "jadeadorn.checkout.idempotencyKey";

function randomKey() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return "ck_" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** One key per checkout attempt; survives a refresh so a resubmit cannot create a second order. */
function getIdempotencyKey(): string {
  try {
    const existing = sessionStorage.getItem(KEY_STORAGE);
    if (existing) return existing;
    const key = randomKey();
    sessionStorage.setItem(KEY_STORAGE, key);
    return key;
  } catch {
    return randomKey();
  }
}

function resetIdempotencyKey() {
  try {
    sessionStorage.removeItem(KEY_STORAGE);
  } catch {}
}

const EMPTY: CustomerDetailsInput = {
  fullName: "",
  email: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "US",
};

type Field = keyof CustomerDetailsInput;

export function CheckoutForm() {
  const router = useRouter();
  const { lines, hydrated, subtotalCents, clear } = useCart();
  const online = useOnlineStatus();
  const [values, setValues] = useState<CustomerDetailsInput>(EMPTY);
  const [token, setToken] = useState<MockPaymentToken>("tok_mock_success");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const inFlight = useRef(false);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (formError) errorRef.current?.focus();
  }, [formError]);

  if (!hydrated) {
    return <div className="h-64 animate-pulse bg-soft" aria-busy="true" aria-label="Loading checkout" />;
  }

  if (lines.length === 0 && !completed) {
    return (
      <div className="border border-dashed border-line px-6 py-14 text-center" data-testid="checkout-empty">
        <p className="font-serif text-xl">Your bag is empty.</p>
        <p className="mt-2 text-sm text-muted">Add a piece before checking out.</p>
        <Link href="/products" className="btn-primary mt-6">
          Browse the collection
        </Link>
      </div>
    );
  }

  const set = (field: Field) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setValues((v) => ({ ...v, [field]: e.target.value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inFlight.current) return;
    setFormError(null);

    if (!navigator.onLine) {
      setFormError("You’re offline. Payment requires an internet connection — no order was placed.");
      return;
    }
    const parsed = customerDetailsSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      setFormError("Please correct the highlighted fields.");
      return;
    }

    inFlight.current = true;
    setSubmitting(true);
    setErrors({});
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: getIdempotencyKey(),
          customer: parsed.data,
          items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
          payment: { provider: "mock", token },
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.order?.publicId) {
        setCompleted(true);
        resetIdempotencyKey();
        clear();
        router.replace(`/orders/${data.order.publicId}`);
        return;
      }
      const code: string | undefined = data?.error?.code;
      if (code === "PAYMENT_DECLINED") {
        // Nothing was persisted; the next attempt is a new payment with a fresh key.
        resetIdempotencyKey();
        setFormError(
          "Payment declined (test card). No charge was made and no order was created. Choose the “approve” test card and try again.",
        );
      } else if (code === "VALIDATION_ERROR") {
        const fields: Record<string, string> = data?.error?.details?.fields ?? {};
        setErrors(Object.fromEntries(Object.entries(fields).map(([k, v]) => [k.replace(/^customer\./, ""), v])));
        setFormError(data.error.message);
      } else if (code === "PRODUCT_UNAVAILABLE") {
        setFormError("Some items are no longer available. Please review your bag.");
      } else {
        setFormError(data?.error?.message ?? "Something went wrong. Please try again.");
      }
    } catch {
      // The request may or may not have reached the server; retrying reuses the same key,
      // so the server returns the existing order instead of charging twice.
      setFormError("We couldn’t reach the server. Check your connection and try again — you won’t be charged twice.");
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  const disabled = submitting || completed || !online;

  const input = (field: Field, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label htmlFor={field} className="mb-1.5 block text-xs font-semibold tracking-wide">
        {label}
        {props.required === false && <span className="font-normal text-muted"> (optional)</span>}
      </label>
      <input
        id={field}
        name={field}
        value={(values[field] as string) ?? ""}
        onChange={set(field)}
        aria-invalid={errors[field] ? true : undefined}
        aria-describedby={errors[field] ? `${field}-error` : undefined}
        className="field-input"
        {...props}
        required={props.required !== false}
      />
      {errors[field] && (
        <p id={`${field}-error`} className="mt-1 text-xs text-danger">
          {errors[field]}
        </p>
      )}
    </div>
  );

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-8 lg:grid-cols-[1fr_360px]" data-testid="checkout-form">
      <div className="space-y-8">
        <fieldset className="space-y-4">
          <legend className="mb-3 font-serif text-xl">Contact</legend>
          {input("fullName", "Full name", { autoComplete: "name" })}
          {input("email", "Email", { type: "email", autoComplete: "email", inputMode: "email" })}
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="mb-3 font-serif text-xl">Shipping address</legend>
          {input("addressLine1", "Address line 1", { autoComplete: "address-line1" })}
          {input("addressLine2", "Address line 2", { autoComplete: "address-line2", required: false })}
          <div className="grid gap-4 sm:grid-cols-2">
            {input("city", "City", { autoComplete: "address-level2" })}
            {input("state", "State / region", { autoComplete: "address-level1" })}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {input("postalCode", "ZIP / postal code", { autoComplete: "postal-code" })}
            <div>
              <label htmlFor="country" className="mb-1.5 block text-xs font-semibold tracking-wide">
                Country
              </label>
              <select id="country" name="country" value={values.country} onChange={set("country")} className="field-input" autoComplete="country">
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-3 font-serif text-xl">Payment</legend>
          <div className="border-2 border-dashed border-gold bg-gold-light/30 p-4" data-testid="test-payment-banner">
            <p className="text-sm font-bold tracking-wide">TEST PAYMENT — NO REAL CHARGE</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              This store uses a mock payment provider. Do not enter real card details — none are collected.
              Pick a test card to simulate the outcome.
            </p>
            <div className="mt-3 space-y-2">
              {(
                [
                  ["tok_mock_success", "Test card — payment approved"],
                  ["tok_mock_decline", "Test card — payment declined"],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="flex min-h-11 cursor-pointer items-center gap-3 border border-line bg-paper px-3">
                  <input
                    type="radio"
                    name="paymentToken"
                    value={value}
                    checked={token === value}
                    onChange={() => setToken(value)}
                    className="h-4 w-4 accent-jade-700"
                  />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>
          </div>
        </fieldset>
      </div>

      <aside className="h-fit space-y-4 border border-line bg-paper p-5 lg:sticky lg:top-4" aria-label="Order summary">
        <h2 className="font-serif text-xl">Order summary</h2>
        <ul className="divide-y divide-line text-sm">
          {lines.map((l) => (
            <li key={l.productId} className="flex justify-between gap-3 py-2">
              <span>
                {l.name} <span className="text-muted">× {l.quantity}</span>
              </span>
              <span className="shrink-0">{formatCents(l.priceCents * l.quantity)}</span>
            </li>
          ))}
        </ul>
        <dl className="space-y-1.5 border-t border-line pt-3 text-sm">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd>{formatCents(subtotalCents)}</dd>
          </div>
          <div className="flex justify-between text-muted">
            <dt>Shipping</dt>
            <dd>$0.00</dd>
          </div>
          <div className="flex justify-between text-muted">
            <dt>Tax</dt>
            <dd>$0.00</dd>
          </div>
          <div className="flex justify-between border-t border-line pt-2 text-base font-semibold">
            <dt>Total</dt>
            <dd data-testid="checkout-total">{formatCents(subtotalCents)}</dd>
          </div>
        </dl>

        {formError && (
          <div ref={errorRef} tabIndex={-1} role="alert" className="border border-danger/40 bg-danger/5 p-3 text-sm text-danger" data-testid="checkout-error">
            {formError}
          </div>
        )}

        {!online && (
          <div role="status" className="border border-gold bg-gold-light/40 p-3 text-sm" data-testid="offline-checkout-notice">
            <strong>Payment requires an internet connection.</strong> You’re offline, so checkout is disabled. Your bag is
            saved — reconnect to place your order.
          </div>
        )}

        <button type="submit" className="btn-primary w-full" disabled={disabled} data-testid="place-order" aria-disabled={disabled}>
          {submitting ? "Processing test payment…" : !online ? "Requires connection" : `Pay ${formatCents(subtotalCents)} (test)`}
        </button>
        <p className="text-center text-[11px] text-muted">The server recalculates all prices before charging.</p>
      </aside>
    </form>
  );
}
