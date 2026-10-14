#!/usr/bin/env node
/**
 * Zero-dependency static server for the UI Lab.
 *
 * Serves `ui-lab/` at `/` and the POS's `public/` folder at `/assets/` so the
 * hero mock-ups can reuse the real menu photos and logo without being part of
 * the Next.js app (which is deliberately un-iframeable: CSP frame-ancestors
 * 'none'). Nothing here touches the POS runtime, database or security headers.
 *
 *   node ui-lab/serve.mjs            # http://0.0.0.0:4173
 *   PORT=5000 node ui-lab/serve.mjs
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const LAB_ROOT = resolve(here);
const ASSET_ROOT = resolve(here, "..", "public");
const PORT = Number(process.env.PORT) || 4173;
const HOST = process.env.HOST || "0.0.0.0";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

function send(res, status, body, type = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(body);
}

/** Map a URL path onto a file inside one of the two allowed roots, or null. */
function resolveFile(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  const isAsset = decoded === "/assets" || decoded.startsWith("/assets/");
  const base = isAsset ? ASSET_ROOT : LAB_ROOT;
  const relative = isAsset ? decoded.slice("/assets".length) : decoded;
  const target = resolve(base, "." + relative);
  // Path traversal guard: the resolved file must stay inside its root.
  if (target !== base && !target.startsWith(base + sep)) return null;
  return target;
}

const server = createServer(async (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return send(res, 405, "Method Not Allowed");
  }
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  let file = resolveFile(url.pathname);
  if (!file) return send(res, 403, "Forbidden");

  try {
    let info = await stat(file);
    if (info.isDirectory()) {
      file = resolve(file, "index.html");
      info = await stat(file);
    }
    if (!info.isFile()) return send(res, 404, "Not Found");
    const body = await readFile(file);
    const type = MIME[extname(file).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": type,
      "Content-Length": body.length,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(req.method === "HEAD" ? undefined : body);
  } catch {
    send(res, 404, "Not Found");
  }
});

server.listen(PORT, HOST, () => {
  console.log(`UI Lab  →  http://${HOST}:${PORT}/   (assets from ${ASSET_ROOT})`);
});
