import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { brand } from "@/content/site";

export const metadata: Metadata = {
  title: { default: `${brand.name} — ${brand.tagline}`, template: `%s · ${brand.name}` },
  description:
    "Touchscreen point-of-sale for restaurant, bar and room-service operations in Ghana: Cash and MoMo tender, kitchen display, recipe-linked stock and GRA VAT on every receipt.",
  icons: { icon: [{ url: "/logo.svg", type: "image/svg+xml" }] },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-zinc-950 font-sans text-zinc-50">{children}</body>
    </html>
  );
}
