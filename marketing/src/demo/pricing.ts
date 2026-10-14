/**
 * Bill maths, mirrored from the POS's src/lib/pricing-core.ts so the demo's
 * totals are the totals the real till would charge: integer pesewas, VAT on
 * goods plus the room-service charge, tips untaxed (none in the demo).
 */
import { BILLING, MENU_BY_ID, type OrderType } from "./data";

export const toCents = (v: number) => Math.round(v * 100);
export const fromCents = (c: number) => (c / 100).toFixed(2);

export const ghs = (cents: number, sign = false) =>
  `${sign && cents > 0 ? "+" : cents < 0 ? "−" : ""}GH₵ ${(Math.abs(cents) / 100).toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export type Line = { id: string; itemId: string; qty: number; note: string; sent: boolean };

export type Priced = {
  subtotalCents: number;
  roomChargeCents: number;
  taxableCents: number;
  taxCents: number;
  totalCents: number;
};

export function priceLines(lines: Line[], type: OrderType): Priced {
  const subtotalCents = lines.reduce((sum, l) => sum + toCents(MENU_BY_ID[l.itemId].price) * l.qty, 0);
  const roomChargeCents = type === "room_service" && subtotalCents > 0 ? BILLING.roomChargeCents : 0;
  const taxableCents = subtotalCents + roomChargeCents;
  const taxCents = Math.round((taxableCents * BILLING.taxRatePercent) / 100);
  return { subtotalCents, roomChargeCents, taxableCents, taxCents, totalCents: taxableCents + taxCents };
}
