import type { NextConfig } from "next";
import { execSync } from "node:child_process";

// Which commit is actually running? Baking it in at build time turns "is the
// new code live?" from detective work into one line of /api/health.
let commit = "unknown";
try {
  commit = execSync("git rev-parse --short HEAD", { cwd: process.cwd(), stdio: ["ignore", "pipe", "ignore"] })
    .toString()
    .trim();
} catch {
  commit = "unknown";
}

// Baseline hardening for every response, including the API. This app holds
// session cookies and money, so clickjacking / MIME-sniffing / referrer
// leakage must not depend on whichever reverse proxy happens to be in front.
//
// CSP notes (deliberate, review before tightening):
// - 'unsafe-inline' in script-src/style-src is required today: the root page
//   is statically prerendered (Next injects inline bootstrap scripts) and
//   layout.tsx applies the per-device display size with an inline script
//   before first paint. There is no 'unsafe-eval' and no external origin is
//   allowed anywhere, so injected markup still cannot load remote code.
//   Moving to nonce-based CSP means giving up static prerendering (or a
//   middleware nonce pass) — a separate, deliberate change.
// - frame-ancestors 'none' + X-Frame-Options DENY: the POS is never iframed.
// - HSTS is production-only (browsers ignore it over http, and dev/preview
//   origins must not be pinned).
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
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
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
    : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Dev-only origin allowlist (HMR). Production cookies/CSRF use APP_ORIGIN.
  allowedDevOrigins: ["*.e2b.app", "127.0.0.1"],
  env: { APP_BUILD_COMMIT: commit },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
