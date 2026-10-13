import { randomBytes } from "node:crypto";

/**
 * Human-readable number for a purchase order or goods receipt, such as
 * PO-20261013-3F9A2C1B. These are printed on paperwork a supplier signs, so
 * they stay short.
 *
 * The number is built from the UTC date plus 32 random bits. The old scheme
 * used the last six digits of the millisecond clock, which repeat every
 * 1,000,000 ms (about 16 minutes), so a few thousand documents would almost
 * certainly collide. The unique constraint on each number column still
 * refuses any repeat; with 32 random bits a repeat on a given day is roughly
 * one in four billion per pair of documents.
 */
export function documentNumber(prefix: "PO" | "GRN", now: Date = new Date()): string {
  const day = now.toISOString().slice(0, 10).replace(/-/g, "");
  return `${prefix}-${day}-${randomBytes(4).toString("hex").toUpperCase()}`;
}
