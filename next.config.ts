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
// CSP: pages get a per-request nonce policy from src/proxy.ts (N24), with no
// 'unsafe-inline' for scripts. This static policy covers everything else the
// server answers (the API, the service worker script, public files): nothing
// there renders HTML, but the service worker's fetches follow its script's
// policy, so it must still allow 'self'.
// - frame-ancestors 'none' + X-Frame-Options DENY: the POS is never iframed.
// - HSTS is production-only (browsers ignore it over http, and dev/preview
//   origins must not be pinned).
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self'",
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
  // Only full screen is used (the till's full-screen button); every other
  // powerful feature is off for this origin and anything it might embed (N25).
  {
    key: "Permissions-Policy",
    value:
      "fullscreen=(self), camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), hid=(), bluetooth=(), " +
      "midi=(), magnetometer=(), gyroscope=(), accelerometer=(), display-capture=(), screen-wake-lock=(), " +
      "publickey-credentials-get=(), browsing-topics=(), interest-cohort=()",
  },
  // Cross-origin isolation (N25): no other site's window can hold a handle to
  // this one, and no other site can embed this server's responses.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
    : []),
];

const nextConfig: NextConfig = {
  // Deploys build into `.next-build` (NEXT_DIST_DIR, set only by
  // scripts/deploy-vps.sh) while the live app keeps serving `.next`. The finished
  // build is renamed to `.next-release-<commit>-<time>` (same depth as `.next`,
  // so the build's relative links still resolve) and `.next` becomes a link to
  // it: the switch-over is one atomic rename and rollback is pointing the link
  // back (P3 in docs/FINDINGS.md). `.next-build` is listed in tsconfig.json so
  // the build does not rewrite it; release folders are excluded from type checks.
  // Unset, this is the normal `.next`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  // Dev-only origin allowlist (HMR). Production cookies/CSRF use APP_ORIGIN.
  allowedDevOrigins: ["*.e2b.app", "127.0.0.1"],
  env: { APP_BUILD_COMMIT: commit },
  async headers() {
    // Pages get their CSP from src/proxy.ts; everything else gets the static
    // one here. Both get the other headers.
    const others = securityHeaders.filter((h) => h.key !== "Content-Security-Policy");
    return [
      { source: "/:path*", headers: others },
      { source: "/api/:path*", headers: [{ key: "Content-Security-Policy", value: contentSecurityPolicy }] },
      { source: "/_next/:path*", headers: [{ key: "Content-Security-Policy", value: contentSecurityPolicy }] },
      { source: "/:file(sw\\.js|manifest\\.json|robots\\.txt|logo\\.svg)", headers: [{ key: "Content-Security-Policy", value: contentSecurityPolicy }] },
      { source: "/menu-images/:path*", headers: [{ key: "Content-Security-Policy", value: contentSecurityPolicy }] },
    ];
  },
};

export default nextConfig;
