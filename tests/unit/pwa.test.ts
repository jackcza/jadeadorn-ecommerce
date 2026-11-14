import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";
import nextConfig from "../../next.config";

const require = createRequire(import.meta.url);
const sw = require("../../public/sw.js") as {
  classifyRequest: (r: { method: string; url: string; mode?: string; origin: string; isRsc?: boolean }) => string;
  isCacheableResponse: (r: Response) => boolean;
  PRECACHE_URLS: string[];
};

const ORIGIN = "https://shop.example";
const req = (path: string, extra: Partial<{ method: string; mode: string; isRsc: boolean; origin: string }> = {}) =>
  sw.classifyRequest({ method: "GET", url: ORIGIN + path, origin: ORIGIN, ...extra });

function pngSize(file: string) {
  const buf = readFileSync(join(process.cwd(), "public", file));
  expect(buf.subarray(1, 4).toString()).toBe("PNG");
  return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
}

describe("PWA manifest (10)", () => {
  const m = manifest();

  it("has the required install fields", () => {
    expect(m).toMatchObject({
      name: "JadeAdorn",
      short_name: "JadeAdorn",
      start_url: "/",
      display: "standalone",
      theme_color: "#354d40",
      background_color: "#fbf9f5",
    });
  });

  it("ships real 192px, 512px and maskable PNG icons", () => {
    const icons = m.icons ?? [];
    const bySize = (s: string, purpose = "any") => icons.find((i) => i.sizes === s && (i.purpose ?? "any") === purpose);
    expect(bySize("192x192")).toBeDefined();
    expect(bySize("512x512")).toBeDefined();
    expect(bySize("512x512", "maskable")).toBeDefined();
    for (const icon of icons) {
      const [w, h] = pngSize(icon.src);
      expect(`${w}x${h}`).toBe(icon.sizes);
    }
    expect(pngSize("/icons/apple-touch-icon.png")).toEqual([180, 180]);
  });
});

describe("service worker caching rules (10)", () => {
  it("never caches checkout, order APIs or confirmation pages", () => {
    expect(req("/api/checkout", { method: "POST" })).toBe("network-only");
    expect(req("/api/checkout")).toBe("network-only");
    expect(req("/api/orders/abc123")).toBe("network-only");
    expect(req("/orders/abc123")).toBe("network-only");
    expect(req("/orders/abc123", { isRsc: true })).toBe("network-only");
    // Navigations get an offline fallback page but the response itself is never stored.
    expect(req("/orders/abc123", { mode: "navigate" })).toBe("navigate-uncached");
  });

  it("never caches non-GET or cross-origin requests", () => {
    expect(req("/api/products", { method: "POST" })).toBe("network-only");
    expect(sw.classifyRequest({ method: "GET", url: "https://cdn.other.example/x.js", origin: ORIGIN })).toBe("network-only");
  });

  it("caches static assets, catalog API GETs and public catalog pages", () => {
    expect(req("/_next/static/chunks/app.js")).toBe("static");
    expect(req("/images/products/a.svg")).toBe("static");
    expect(req("/icons/icon-192.png")).toBe("static");
    expect(req("/manifest.webmanifest")).toBe("static");
    expect(req("/api/categories")).toBe("catalog-api");
    expect(req("/api/products")).toBe("catalog-api");
    expect(req("/api/products?category=natural-stone")).toBe("catalog-api");
    expect(req("/api/products/sandalwood-prayer-mala")).toBe("catalog-api");
    for (const page of ["/", "/products", "/products/sandalwood-prayer-mala", "/category/gift-sets", "/cart", "/checkout", "/offline"]) {
      expect(req(page, { mode: "navigate" })).toBe("page");
    }
    expect(req("/products/x", { isRsc: true })).toBe("network-only");
    expect(req("/some-other-page", { mode: "navigate" })).toBe("navigate-uncached");
  });

  it("precaches the offline page and refuses responses flagged sensitive", () => {
    expect(sw.PRECACHE_URLS).toContain("/offline");
    expect(sw.PRECACHE_URLS.some((u) => u.startsWith("/orders") || u.startsWith("/api/checkout"))).toBe(false);
    const ok = (headers: Record<string, string> = {}) => {
      const r = new Response("x", { status: 200, headers });
      Object.defineProperty(r, "type", { value: "basic" });
      return r;
    };
    expect(sw.isCacheableResponse(ok())).toBe(true);
    expect(sw.isCacheableResponse(ok({ "X-JadeAdorn-Sensitive": "1" }))).toBe(false);
    const error = new Response("x", { status: 500 });
    Object.defineProperty(error, "type", { value: "basic" });
    expect(sw.isCacheableResponse(error)).toBe(false);
  });

  it("server marks checkout/order routes no-store + sensitive", async () => {
    const headers = await nextConfig.headers!();
    for (const source of ["/api/checkout", "/api/orders/:path*", "/orders/:path*"]) {
      const rule = headers.find((h) => h.source === source);
      expect(rule?.headers).toEqual(
        expect.arrayContaining([
          { key: "Cache-Control", value: expect.stringContaining("no-store") },
          { key: "X-JadeAdorn-Sensitive", value: "1" },
        ]),
      );
    }
  });
});
