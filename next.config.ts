import type { NextConfig } from "next";

const noStore = [
  { key: "Cache-Control", value: "no-store, max-age=0" },
  { key: "X-JadeAdorn-Sensitive", value: "1" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Loaded from node_modules rather than bundled, so pino can start its pino-pretty worker in dev.
  serverExternalPackages: ["pino"],
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
      { source: "/api/checkout", headers: noStore },
      { source: "/api/orders/:path*", headers: noStore },
      { source: "/orders/:path*", headers: noStore },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
