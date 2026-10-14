import type { NextConfig } from "next";

// Static marketing site: `next build` writes plain HTML/CSS/JS to ./out, which
// can sit behind the same nginx as the POS or on any static host. Nothing
// here is shared with the POS runtime, its CSP or its database.
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
  // Dev-only: lets the sandbox preview host reach HMR.
  allowedDevOrigins: ["*.e2b.app", "127.0.0.1"],
  // This app lives inside the POS repository, which has its own lockfile.
  turbopack: { root: process.cwd() },
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
