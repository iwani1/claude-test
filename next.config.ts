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

const nextConfig: NextConfig = {
  // Dev-only origin allowlist (HMR). Production cookies/CSRF use APP_ORIGIN.
  allowedDevOrigins: ["*.e2b.app", "127.0.0.1", "localhost"],
  env: { APP_BUILD_COMMIT: commit },
};

export default nextConfig;
