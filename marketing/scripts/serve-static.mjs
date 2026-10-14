#!/usr/bin/env node
/**
 * Zero-dependency server for the static export in ./out — what `next build`
 * produces. Mirrors how nginx would serve it: `/x/` → `/x/index.html`,
 * missing files → 404.html. Optionally redirects `/` somewhere else so a
 * preview can open straight on the live demo.
 *
 *   npm run build
 *   node scripts/serve-static.mjs                       # http://0.0.0.0:3100
 *   PORT=3200 ROOT_REDIRECT=/demo/ node scripts/serve-static.mjs
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, "..", "out");
const PORT = Number(process.env.PORT) || 3100;
const HOST = process.env.HOST || "0.0.0.0";
const ROOT_REDIRECT = process.env.ROOT_REDIRECT || "";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

async function fileAt(path) {
  try {
    const s = await stat(path);
    return s.isFile() ? path : s.isDirectory() ? fileAt(resolve(path, "index.html")) : null;
  } catch {
    return null;
  }
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://x");
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/" && ROOT_REDIRECT) {
    res.writeHead(302, { Location: ROOT_REDIRECT });
    return res.end();
  }
  const target = resolve(ROOT, "." + pathname);
  if (!target.startsWith(ROOT + sep) && target !== ROOT) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  let file = await fileAt(target);
  if (!file && !extname(pathname)) file = await fileAt(target + ".html");
  let status = 200;
  if (!file) {
    file = await fileAt(resolve(ROOT, "404.html"));
    status = 404;
  }
  if (!file) {
    res.writeHead(404);
    return res.end("Not found");
  }
  const body = await readFile(file);
  const immutable = pathname.startsWith("/_next/static/");
  res.writeHead(status, {
    "Content-Type": MIME[extname(file)] ?? "application/octet-stream",
    "Content-Length": body.length,
    "Cache-Control": immutable ? "public, max-age=31536000, immutable" : "no-cache",
  });
  res.end(req.method === "HEAD" ? undefined : body);
}).listen(PORT, HOST, () => {
  console.log(`Static export from ${ROOT}\n→ http://${HOST}:${PORT}${ROOT_REDIRECT ? `  (/ → ${ROOT_REDIRECT})` : ""}`);
});
