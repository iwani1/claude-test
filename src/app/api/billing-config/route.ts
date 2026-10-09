import { secureRoute } from "@/lib/api";
import { NextResponse } from "next/server";
import { loadBillingConfig } from "@/lib/pricing";
import { fromCents } from "@/lib/pricing-core";
import { requireSession } from "@/lib/guard";

/**
 * Exposes the live billing rules to the POS screen so the till can display the
 * same room charge and VAT the server will actually apply.
 *
 * Requires a session: these are the restaurant's pricing rules, not public
 * data. Reading them is harmless but there is no reason to serve them
 * anonymously.
 */
async function handleGET() {
  try {
    const guard = await requireSession();
    if (!guard.ok) return guard.response;

    const config = await loadBillingConfig();

    return NextResponse.json({
      roomCharge: fromCents(config.roomChargeCents),
      roomChargeCents: config.roomChargeCents,
      taxRatePercent: config.taxRatePercent,
      compBreakfastEnabled: config.compBreakfastEnabled,
    });
  } catch (err) {
    console.error("Failed to load billing config:", err);
    return NextResponse.json({ error: "Could not load billing configuration." }, { status: 500 });
  }
}

export const GET = secureRoute(handleGET, "session");
