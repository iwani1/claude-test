import { NextResponse, type NextRequest } from "next/server";

/**
 * Per-request Content Security Policy for pages (N24 in docs/FINDINGS.md).
 *
 * Each page response gets a fresh random nonce. Only scripts that carry it
 * may run: Next.js adds it to its own scripts and bundles, and layout.tsx
 * adds it to the two pre-paint scripts. There is no 'unsafe-inline' for
 * scripts, so markup injected into a page (a stored name, a crafted link)
 * cannot run code even if some future bug lets it through React's escaping.
 * 'strict-dynamic' lets those trusted scripts load the app's own chunks.
 *
 * Styles keep 'unsafe-inline': React writes style attributes, which nonces
 * cannot cover, and CSS cannot run code under this policy.
 *
 * API routes, static files and Next's build assets are not pages and keep the
 * static headers from next.config.ts.
 */
export function proxy(request: NextRequest) {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  const nonce = btoa(String.fromCharCode(...bytes));
  const dev = process.env.NODE_ENV !== "production";
  const csp = [
    "default-src 'self'",
    // React's development build needs eval for its error overlays; production never does.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  // Next reads the nonce from the request's CSP header while rendering.
  requestHeaders.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Pages only: not the API, Next's build files, or files in public/.
      source: "/((?!api/|_next/static|_next/image|sw\\.js|manifest\\.json|robots\\.txt|logo\\.svg|menu-images/).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
