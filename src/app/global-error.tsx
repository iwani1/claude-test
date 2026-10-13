"use client";

/**
 * Last-resort boundary: catches failures in the root layout itself, where
 * error.tsx cannot render. Must define its own <html>/<body>. Kept
 * dependency-free (no global CSS assumptions — the layout may be what
 * failed) and deliberately plain: its only job is to never show a browser
 * white screen on a till.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#0a0a0a", color: "#f5f5f5", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ maxWidth: 420, textAlign: "center" }}>
            <h1 style={{ fontSize: 22 }}>The till hit a problem</h1>
            <p style={{ color: "#d4d4d4", lineHeight: 1.6 }}>
              Completed orders are safe on the server and offline orders are still stored on this device.
              Reload to carry on.
            </p>
            <button
              onClick={reset}
              style={{ minHeight: 48, padding: "12px 24px", borderRadius: 14, border: 0, background: "#f43f5e", color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer" }}
            >
              Reload the till
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
