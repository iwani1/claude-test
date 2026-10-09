/**
 * Pure bill-pricing maths shared by the server and the POS screen.
 *
 * This module has NO database imports so it can run in the browser. Both the
 * API and the till call the exact same function, which is what keeps the
 * on-screen total identical to the amount actually charged — a displayed
 * total that differs from the stored one would be a refund dispute waiting to
 * happen.
 *
 * All amounts are integer pesewas (GH₵ x 100) to avoid float drift.
 */

export const toCents = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

export const fromCents = (c: number): string => (c / 100).toFixed(2);

export interface BillingConfig {
  /** Flat charge when the guest eats in the room, in pesewas. */
  roomChargeCents: number;
  /** VAT percentage. */
  taxRatePercent: number;
  /** Whether complimentary breakfast may be recorded. */
  compBreakfastEnabled: boolean;
}

export interface PricedLine {
  unitPrice: string | number;
  quantity: number;
  /** Modifier surcharges kept separate from the base unit price. */
  modifierTotal?: string | number;
}

export interface PricingInput {
  lines: PricedLine[];
  orderType: string;
  discountCents?: number;
  discountPercent?: number;
  tipCents?: number;
  isComplimentary?: boolean;
  config: BillingConfig;
}

export interface PricingResult {
  subtotalCents: number;
  discountCents: number;
  discountPercent: number;
  /** VAT base: goods after discount plus the room charge. */
  taxableCents: number;
  taxCents: number;
  taxRatePercent: number;
  roomChargeCents: number;
  tipCents: number;
  totalCents: number;
  isComplimentary: boolean;
  /** Retail value of free food, for management reporting. */
  compValueCents: number;
}

/**
 * The one place a bill total is decided.
 *
 * Rules:
 *  - room_service adds the configurable room charge; restaurant dine-in,
 *    takeaway and delivery never do.
 *  - VAT applies to goods (after discount) AND the room charge, because the
 *    room charge is part of the restaurant's taxable supply. Tips are not
 *    taxed.
 *  - A complimentary order totals GH₵0.00 with no VAT and no room charge, but
 *    still reports the retail value of the food given away.
 */
export function priceOrder(input: PricingInput): PricingResult {
  const { lines, orderType, config } = input;

  const subtotalCents = lines.reduce((sum, l) => {
    const qty = Number(l.quantity) || 0;
    const unit = toCents(l.unitPrice) + toCents(l.modifierTotal ?? 0);
    return sum + Math.max(0, Math.round(unit * qty));
  }, 0);

  // --- Discount -----------------------------------------------------------
  let discountPercent = Number(input.discountPercent) || 0;
  if (discountPercent < 0) discountPercent = 0;
  if (discountPercent > 100) discountPercent = 100;

  let discountCents =
    discountPercent > 0
      ? Math.round((subtotalCents * discountPercent) / 100)
      : Math.max(0, Number(input.discountCents) || 0);
  if (discountCents > subtotalCents) discountCents = subtotalCents;

  const afterDiscountCents = subtotalCents - discountCents;

  // --- Complimentary breakfast -------------------------------------------
  if (input.isComplimentary) {
    return {
      subtotalCents,
      discountCents: subtotalCents,
      discountPercent: subtotalCents > 0 ? 100 : 0,
      taxableCents: 0,
      taxCents: 0,
      taxRatePercent: config.taxRatePercent,
      roomChargeCents: 0,
      tipCents: 0,
      totalCents: 0,
      isComplimentary: true,
      compValueCents: subtotalCents,
    };
  }

  // --- Room charge --------------------------------------------------------
  const roomChargeCents = orderType === "room_service" ? config.roomChargeCents : 0;

  // --- VAT ----------------------------------------------------------------
  const taxableCents = afterDiscountCents + roomChargeCents;
  const taxCents = Math.round((taxableCents * config.taxRatePercent) / 100);

  const tipCents = Math.max(0, Number(input.tipCents) || 0);
  const totalCents = Math.max(0, afterDiscountCents + roomChargeCents + taxCents + tipCents);

  return {
    subtotalCents,
    discountCents,
    discountPercent,
    taxableCents,
    taxCents,
    taxRatePercent: config.taxRatePercent,
    roomChargeCents,
    tipCents,
    totalCents,
    isComplimentary: false,
    compValueCents: 0,
  };
}
