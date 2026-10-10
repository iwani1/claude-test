import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev-only origin allowlist (HMR). Production cookies/CSRF use APP_ORIGIN.
  allowedDevOrigins: ["*.e2b.app", "127.0.0.1", "localhost"],
};

export default nextConfig;
