"use client";

import { useOnlineStatus } from "@/lib/use-online-status";

export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div
      role="status"
      data-testid="offline-banner"
      className="sticky top-0 z-40 bg-[#5a4a2c] px-4 py-2 text-center text-xs tracking-wide text-white"
    >
      You’re offline. Saved pages and your bag still work; checkout requires a connection.
    </div>
  );
}
