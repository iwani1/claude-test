import { createHash } from "node:crypto";

/**
 * Dish photos uploaded in the Menu Manager are stored on the item as
 * `data:image/...;base64,...` URLs (up to ~380 KB each). The menu list sends a
 * short link to /api/menu/<id>/photo instead (N8 in docs/FINDINGS.md).
 */

/** Only real image types are ever served back as images. */
const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export function parsePhotoDataUrl(value: string | null | undefined): { mimeType: string; bytes: Buffer } | null {
  if (typeof value !== "string") return null;
  const match = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/i.exec(value);
  if (!match || !PHOTO_TYPES.has(match[1].toLowerCase())) return null;
  return { mimeType: match[1].toLowerCase(), bytes: Buffer.from(match[2], "base64") };
}

/** The link the menu list uses in place of an uploaded photo. */
export function photoLink(itemId: number, dataUrl: string): string {
  const version = createHash("sha256").update(dataUrl).digest("base64url").slice(0, 16);
  return `/api/menu/${itemId}/photo?v=${version}`;
}

/** True for a photo link the editor echoes back unchanged on save. */
export function isPhotoLink(value: unknown): boolean {
  return typeof value === "string" && /^\/api\/menu\/\d+\/photo(\?|$)/.test(value);
}
