import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { menuItems } from "@/db/schema";
import { ApiError, secureRoute } from "@/lib/api";
import { parsePhotoDataUrl } from "@/lib/menu-photo";

/**
 * A dish photo uploaded in the Menu Manager, served as an image (N8 in
 * docs/FINDINGS.md). Photos are stored on the item as data URLs; the menu list
 * now links here instead of carrying every photo inline, so the list, and the
 * till's offline copy of it, stay small.
 *
 * The link carries a content hash (?v=...), so the browser may keep the image
 * for good: a new photo gets a new link.
 */
export const GET = secureRoute(async (_req, { params }) => {
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) throw new ApiError(400, "Invalid menu item id");
  const [item] = await db.select({ imageUrl: menuItems.imageUrl }).from(menuItems).where(eq(menuItems.id, id)).limit(1);
  const photo = parsePhotoDataUrl(item?.imageUrl);
  if (!photo) throw new ApiError(404, "This dish has no uploaded photo");
  return new NextResponse(new Uint8Array(photo.bytes), {
    headers: {
      "Content-Type": photo.mimeType,
      "Content-Length": String(photo.bytes.length),
      // Private: only signed-in staff of this branch can fetch it.
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}, "session");
