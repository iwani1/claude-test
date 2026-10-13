import { db } from "@/db";
import { applicationSettings, restaurants } from "@/db/schema";
import { priceOrder, fromCents, toCents } from "./pricing-core";
import type { BillingConfig } from "./pricing-core";

/**
 * Server-side billing configuration loader.
 *
 * The actual pricing maths lives in ./pricing-core so the POS screen and this
 * API share one implementation. This module only resolves the live config
 * (room charge, VAT rate, comp-breakfast switch) from the database.
 */

export const SETTINGS_KEYS = {
  roomCharge: "room_service_charge",
  legacyRoomCharge: "dine_in_room_charge",
  compBreakfastEnabled: "complimentary_breakfast_enabled",
  taxRate: "tax_rate",
} as const;

export const DEFAULT_ROOM_CHARGE_CENTS = 3000; // GH₵30.00
export const DEFAULT_TAX_RATE = 15; // Ghana GRA VAT %

export type { BillingConfig };
export { priceOrder, fromCents, toCents };

/** Reads the live billing configuration, falling back to sane defaults. */
export async function loadBillingConfig(): Promise<BillingConfig> {
  const rows = await db.select().from(applicationSettings);

  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;

  // VAT: settings row first, then the restaurant default, then hard default.
  let taxRatePercent = Number(map[SETTINGS_KEYS.taxRate]);
  if (!Number.isFinite(taxRatePercent) || taxRatePercent < 0) {
    const [restaurant] = await db.select().from(restaurants).limit(1);
    taxRatePercent = Number(restaurant?.defaultTaxRate);
  }
  if (!Number.isFinite(taxRatePercent) || taxRatePercent < 0) {
    taxRatePercent = DEFAULT_TAX_RATE;
  }

  // Room-service charge: new key wins; the old dine-in key is read for
  // existing installs; absent both means GH₵30 by default.
  const storedRoomCharge =
    map[SETTINGS_KEYS.roomCharge] ?? map[SETTINGS_KEYS.legacyRoomCharge];
  let roomChargeCents = storedRoomCharge
    ? toCents(storedRoomCharge)
    : DEFAULT_ROOM_CHARGE_CENTS;
  // A negative room charge would be a hidden discount; refuse it.
  if (!Number.isFinite(roomChargeCents) || roomChargeCents < 0) roomChargeCents = 0;

  const compRaw = (map[SETTINGS_KEYS.compBreakfastEnabled] ?? "true").toLowerCase();

  return {
    roomChargeCents,
    taxRatePercent,
    compBreakfastEnabled: compRaw !== "false" && compRaw !== "0",
  };
}
