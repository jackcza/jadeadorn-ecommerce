import type { Metadata, Viewport } from "next";
import "./globals.css";
import { CartProvider } from "@/components/cart/CartProvider";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { OfflineBanner } from "@/components/pwa/OfflineBanner";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: { default: "JadeAdorn — Beaded Jewelry & Buddhist Mala", template: "%s · JadeAdorn" },
  description:
    "Everyday beaded bracelets, natural stone, wood beads, malas and meditation beads. A JadeAdorn demo store.",
  applicationName: "JadeAdorn",
  appleWebApp: { capable: true, title: "JadeAdorn", statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#354d40",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <CartProvider>
          <OfflineBanner />
          <SiteHeader />
          <main id="main">{children}</main>
          <SiteFooter />
          <InstallPrompt />
        </CartProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
