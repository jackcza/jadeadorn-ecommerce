/* JadeAdorn service worker. Hand-written (no Workbox) so the caching rules stay explicit and testable.
 *
 * Strategies:
 *   static        cache-first   /_next/static, /icons, /images, manifest
 *   catalog-api   network-first GET /api/categories, /api/products[/slug]
 *   page          network-first public catalog pages, cart and checkout shells
 *   network-only  everything else, incl. /api/checkout, /api/orders/*, /orders/* (PII / payment)
 */
const VERSION = "v1";
const STATIC_CACHE = `jadeadorn-static-${VERSION}`;
const PAGE_CACHE = `jadeadorn-pages-${VERSION}`;
const API_CACHE = `jadeadorn-api-${VERSION}`;
const CURRENT_CACHES = [STATIC_CACHE, PAGE_CACHE, API_CACHE];
const OFFLINE_URL = "/offline";
const PRECACHE_URLS = [
  "/",
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

// Never cached under any strategy: checkout, order lookups and confirmation pages carry
// customer PII or payment results.
const NEVER_CACHE = [/^\/api\/checkout(\/|$)/, /^\/api\/orders(\/|$)/, /^\/orders(\/|$)/];
const STATIC_PATTERNS = [
  /^\/_next\/static\//,
  /^\/icons\//,
  /^\/images\//,
  /^\/manifest\.webmanifest$/,
  /^\/favicon\.ico$/,
];
const CATALOG_API = [/^\/api\/categories$/, /^\/api\/products$/, /^\/api\/products\/[a-z0-9-]+$/];
const CACHEABLE_PAGES = [
  /^\/$/,
  /^\/products$/,
  /^\/products\/[a-z0-9-]+$/,
  /^\/category\/[a-z0-9-]+$/,
  /^\/cart$/,
  /^\/checkout$/,
  /^\/offline$/,
];

/**
 * Pure routing decision, exported for unit tests.
 * @param {{ method: string, url: string, mode?: string, origin: string, isRsc?: boolean }} req
 * @returns {"network-only" | "static" | "catalog-api" | "page" | "navigate-uncached"}
 */
function classifyRequest(req) {
  if (req.method !== "GET") return "network-only";
  const url = new URL(req.url);
  if (url.origin !== req.origin) return "network-only";
  const path = url.pathname;
  if (NEVER_CACHE.some((re) => re.test(path))) {
    return req.mode === "navigate" ? "navigate-uncached" : "network-only";
  }
  if (STATIC_PATTERNS.some((re) => re.test(path))) return "static";
  if (CATALOG_API.some((re) => re.test(path))) return "catalog-api";
  // React Server Component payloads are tied to a router state; on failure Next.js falls back
  // to a full navigation, which the page strategy below serves from cache.
  if (req.isRsc || url.searchParams.has("_rsc")) return "network-only";
  if (req.mode === "navigate") {
    return CACHEABLE_PAGES.some((re) => re.test(path)) ? "page" : "navigate-uncached";
  }
  return "network-only";
}

// Next.js marks every dynamic page "no-store", so the route allowlist above is the primary rule.
// As a second guard, the server tags PII/payment responses with X-JadeAdorn-Sensitive.
function isCacheableResponse(response) {
  if (!response || response.status !== 200 || response.type !== "basic") return false;
  return response.headers.get("X-JadeAdorn-Sensitive") !== "1";
}

async function putInCache(cacheName, request, response) {
  if (!isCacheableResponse(response)) return;
  const cache = await caches.open(cacheName);
  await cache.put(request, response);
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  putInCache(STATIC_CACHE, request, response.clone());
  return response;
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    putInCache(cacheName, request, response.clone());
    return response;
  } catch (err) {
    const cached = await caches.match(request, { cacheName });
    if (cached) return cached;
    throw err;
  }
}

async function offlineFallback() {
  const offline = await caches.match(OFFLINE_URL);
  return (
    offline ||
    new Response("<h1>You are offline</h1>", {
      status: 503,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    })
  );
}

async function handlePage(request) {
  try {
    return await networkFirst(request, PAGE_CACHE);
  } catch {
    const loose = await caches.match(request, { cacheName: PAGE_CACHE, ignoreSearch: true });
    return loose || offlineFallback();
  }
}

async function handleCatalogApi(request) {
  try {
    return await networkFirst(request, API_CACHE);
  } catch {
    return new Response(
      JSON.stringify({ error: { code: "OFFLINE", message: "You are offline and this data is not cached yet." } }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }
}

if (typeof self !== "undefined" && typeof self.addEventListener === "function") {
  // Cache a page plus the /_next/static chunks its HTML references, so it can hydrate offline
  // even if those chunks were never loaded by this browser (e.g. the offline page).
  const precachePage = async (url) => {
    const response = await fetch(url, { credentials: "same-origin" });
    if (!isCacheableResponse(response)) throw new Error(`Not caching ${url}: ${response.status}`);
    const html = await response.clone().text();
    await (await caches.open(PAGE_CACHE)).put(url, response);
    const assets = [...new Set(html.match(/\/_next\/static\/[^"'\s)\\]+/g) || [])];
    const staticCache = await caches.open(STATIC_CACHE);
    await Promise.all(
      assets.map(async (asset) => {
        if (!(await staticCache.match(asset))) await staticCache.add(asset).catch(() => {});
      }),
    );
  };

  self.addEventListener("install", (event) => {
    event.waitUntil(
      Promise.all([
        ...PRECACHE_URLS.filter((u) => u === "/" || u === OFFLINE_URL).map(precachePage),
        caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS.filter((u) => u !== "/" && u !== OFFLINE_URL))),
      ]).then(() => self.skipWaiting()),
    );
  });

  self.addEventListener("activate", (event) => {
    event.waitUntil(
      caches
        .keys()
        .then((keys) =>
          Promise.all(keys.filter((k) => k.startsWith("jadeadorn-") && !CURRENT_CACHES.includes(k)).map((k) => caches.delete(k))),
        )
        .then(() => self.clients.claim()),
    );
  });

  self.addEventListener("fetch", (event) => {
    const request = event.request;
    const kind = classifyRequest({
      method: request.method,
      url: request.url,
      mode: request.mode,
      origin: self.location.origin,
      isRsc: request.headers.get("RSC") === "1",
    });
    switch (kind) {
      case "static":
        event.respondWith(cacheFirst(request));
        return;
      case "catalog-api":
        event.respondWith(handleCatalogApi(request));
        return;
      case "page":
        event.respondWith(handlePage(request));
        return;
      case "navigate-uncached":
        event.respondWith(fetch(request).catch(() => offlineFallback()));
        return;
      default:
        return; // network-only: let the browser handle it, nothing is cached
    }
  });

  // The first page load happens before the worker controls the page; the client posts the
  // URLs it already loaded so they are available offline right away.
  self.addEventListener("message", (event) => {
    const data = event.data || {};
    if (data.type !== "CACHE_URLS" || !Array.isArray(data.urls)) return;
    event.waitUntil(
      Promise.all(
        data.urls.slice(0, 200).map(async (raw) => {
          try {
            const url = new URL(raw, self.location.origin);
            const kind = classifyRequest({
              method: "GET",
              url: url.href,
              mode: data.navigations && data.navigations.includes(raw) ? "navigate" : "no-cors",
              origin: self.location.origin,
            });
            const cacheName = kind === "static" ? STATIC_CACHE : kind === "page" ? PAGE_CACHE : kind === "catalog-api" ? API_CACHE : null;
            if (!cacheName) return;
            // Pages are refreshed on every visit; immutable assets only once.
            if (kind === "page") return await precachePage(url.pathname);
            if (await caches.match(url.href, { cacheName })) return;
            const response = await fetch(url.href, { credentials: "same-origin" });
            await putInCache(cacheName, url.href, response);
          } catch {
            // best effort
          }
        }),
      ),
    );
  });
}

if (typeof module !== "undefined") {
  module.exports = { classifyRequest, isCacheableResponse, NEVER_CACHE, PRECACHE_URLS, VERSION };
}
