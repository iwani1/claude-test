/**
 * Bill maths, mirrored from the POS's src/lib/pricing-core.ts so the demo's
 * totals are the totals the real till would charge: integer pesewas, VAT on
 * goods (after discount) plus the room-service charge, tips untaxed, and a
 * complimentary order totalling GH₵0.00 while still reporting the food value.
 */
import type { OrderType } from "./data";

export const toCents = (v: number) => Math.round(v * 100);
export const fromCents = (c: number) => (c / 100).toFixed(2);

export const ghs = (cents: number, sign = false) =>
  `${sign && cents > 0 ? "+" : cents < 0 ? "−" : ""}GH₵ ${(Math.abs(cents) / 100).toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/** A bill line keeps the name and price it was sold at, like order_items in the real schema. */
export type Line = { id: string; itemId: string; name: string; unitCents: number; qty: number; note: string; sent: boolean; deducted: boolean };

export type Discount = { kind: "percent" | "fixed"; value: number; reason: string };

export type Billable = {
  lines: Line[];
  type: OrderType;
  discount?: Discount | null;
  tipCents?: number;
  complimentary?: { reason: string; approvedBy: string } | null;
};

export type BillingConfig = { taxRatePercent: number; roomChargeCents: number };

export type Priced = {
  subtotalCents: number;
  discountCents: number;
  discountPercent: number;
  roomChargeCents: number;
  taxableCents: number;
  taxCents: number;
  tipCents: number;
  totalCents: number;
  complimentary: boolean;
  compValueCents: number;
};

export function priceOrder(o: Billable, config: BillingConfig): Priced {
  const subtotalCents = o.lines.reduce((sum, l) => sum + Math.max(0, l.unitCents * l.qty), 0);

  let discountPercent = o.discount?.kind === "percent" ? Math.min(100, Math.max(0, o.discount.value)) : 0;
  let discountCents = o.discount ? (o.discount.kind === "percent" ? Math.round((subtotalCents * discountPercent) / 100) : Math.max(0, toCents(o.discount.value))) : 0;
  if (discountCents > subtotalCents) discountCents = subtotalCents;
  if (o.discount?.kind === "fixed" && subtotalCents > 0) discountPercent = Math.round((discountCents / subtotalCents) * 100);

  if (o.complimentary) {
    return { subtotalCents, discountCents: subtotalCents, discountPercent: subtotalCents ? 100 : 0, roomChargeCents: 0, taxableCents: 0, taxCents: 0, tipCents: 0, totalCents: 0, complimentary: true, compValueCents: subtotalCents };
  }

  const afterDiscountCents = subtotalCents - discountCents;
  const roomChargeCents = o.type === "room_service" && subtotalCents > 0 ? config.roomChargeCents : 0;
  const taxableCents = afterDiscountCents + roomChargeCents;
  const taxCents = Math.round((taxableCents * config.taxRatePercent) / 100);
  const tipCents = Math.max(0, o.tipCents ?? 0);
  return {
    subtotalCents,
    discountCents,
    discountPercent,
    roomChargeCents,
    taxableCents,
    taxCents,
    tipCents,
    totalCents: Math.max(0, afterDiscountCents + roomChargeCents + taxCents + tipCents),
    complimentary: false,
    compValueCents: 0,
  };
}
