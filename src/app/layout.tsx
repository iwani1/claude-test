import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Asanka Royal Bistro & Lounge | Ghanaian Restaurant POS & Inventory ERP",
  description: "Touchscreen-optimized Ghanaian restaurant point-of-sale, Jollof & Waakye kitchen display (KDS), Mobile Money (MoMo) payments, and ingredient recipe inventory control.",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark h-full">
      <body className="h-full bg-neutral-950 text-neutral-100 antialiased overflow-hidden select-none">
        {children}
      </body>
    </html>
  );
}
