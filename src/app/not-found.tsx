import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-5 py-16 text-center">
      <div className="eyebrow">404</div>
      <h1 className="mt-3 font-serif text-3xl font-normal">We couldn’t find that page</h1>
      <p className="mt-3 text-sm text-muted">The piece or order you’re looking for doesn’t exist or is no longer available.</p>
      <Link href="/products" className="btn-primary mt-7">
        Browse the collection
      </Link>
    </div>
  );
}
