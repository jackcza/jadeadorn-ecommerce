"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const SENSITIVE_PATH = /^\/(orders|api\/checkout|api\/orders)(\/|$)/;

function postCacheUrls(sw: ServiceWorker, pathname: string, includeResources: boolean) {
  const resources = includeResources
    ? performance
        .getEntriesByType("resource")
        .map((e) => e.name)
        .filter((u) => u.startsWith(location.origin) && /\/(_next\/static|icons|images)\//.test(u))
    : [];
  const navigations = SENSITIVE_PATH.test(pathname) ? [] : [pathname];
  sw.postMessage({ type: "CACHE_URLS", urls: [...navigations, ...resources], navigations });
}

/**
 * Registers /sw.js in production builds only; dev-mode HMR and a service worker do not mix well.
 * Client-side (Link) navigations fetch RSC payloads rather than HTML, so after each route change
 * we ask the worker to cache that page's HTML for offline use (public pages only).
 */
export function ServiceWorkerRegister() {
  const pathname = usePathname();

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const onLoad = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        const ready = await navigator.serviceWorker.ready;
        if (ready.active) postCacheUrls(ready.active, location.pathname, true);
      } catch (err) {
        console.warn("Service worker registration failed", err);
      }
    };
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const controller = navigator.serviceWorker.controller;
    if (controller && navigator.onLine) postCacheUrls(controller, pathname, true);
  }, [pathname]);

  return null;
}
