import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lush View Hotel | Restaurant, Bar & Hospitality POS",
  description: "Touchscreen POS for restaurant, bar and room-service operations: Cash and MoMo payments, kitchen dockets, and recipe-linked ingredient inventory control.",
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
    <html lang="en" className="dark h-full" data-display-size="large" suppressHydrationWarning>
      <head>
        {/* Applies the terminal's saved display size before first paint so
            every screen loads at the chosen size with no flash. Default on a
            fresh terminal is "large" (18px root) — deliberately bigger than
            the browser default because these screens are driven by fingers. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var s=localStorage.getItem('pos.displaySize');document.documentElement.dataset.displaySize=(s==='standard'||s==='extra'||s==='large')?s:'large'}catch(e){}`,
          }}
        />
      </head>
      <body className="h-full bg-neutral-950 text-neutral-100 antialiased overflow-hidden select-none">
        {children}
      </body>
    </html>
  );
}
