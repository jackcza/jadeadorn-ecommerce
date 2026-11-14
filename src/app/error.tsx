"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg px-5 py-16 text-center" role="alert">
      <h1 className="font-serif text-3xl font-normal">Something went wrong</h1>
      <p className="mt-3 text-sm text-muted">Please try again. If you’re offline, reconnect and retry.</p>
      <div className="mt-7 flex justify-center gap-3">
        <button type="button" onClick={reset} className="btn-primary">
          Try again
        </button>
        <Link href="/" className="btn-outline">
          Home
        </Link>
      </div>
    </div>
  );
}
