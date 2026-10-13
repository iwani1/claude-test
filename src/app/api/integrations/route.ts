import { collectionEvents, reportWindow } from "@/lib/collection-report";
import { secureRoute, ApiError, isDatabaseFailure } from "@/lib/api";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { desc } from "drizzle-orm";
import { requirePermission } from "@/lib/guard";

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

async function handlePOST(req: Request) {
  try {
    // Exporting sales data and probing hardware are management functions.
    const guard = await requirePermission("canViewReports", "POST /api/integrations");
    if (!guard.ok) return guard.response;

    const { action, format, timeframe = "all" } = await req.json();

    // No payment gateway is connected: staff record Cash / MoMo themselves.
    // Never answer with a made-up "approved" transaction.
    if (["test_momo", "test_paystack", "test_stripe", "charge", "authorize"].includes(action)) {
      return NextResponse.json(
        { error: "No payment gateway is connected. Staff record cash and MoMo payments manually at the POS." },
        { status: 501 }
      );
    }

    // Printing goes through the browser's print dialog. There is no server
    // side printer bridge, so don't pretend a job was sent.
    if (action === "test_thermal_printer") {
      return NextResponse.json(
        { error: "No direct printer bridge is configured. Use the browser print dialog and pick the thermal printer." },
        { status: 501 }
      );
    }

    if (action === "export_accounting") {
      if (format !== "quickbooks" && format !== "xero") {
        return NextResponse.json({ error: "Format must be quickbooks or xero." }, { status: 400 });
      }

      const window = reportWindow(timeframe);
      const events = await collectionEvents(window);
      const headers = ["EventID", "EventDateUTC", "OrderID", "ShiftID", "Kind", "GrossCollectionGHS", "RefundGHS", "NetCollectionGHS", "CashPortionGHS", "MoMoPortionGHS", "OtherOrUnallocatedGHS"];
      const rows = events.map(e => [
        `${e.kind}-${e.id}`, new Date(String(e.created_at)).toISOString(), e.order_id, e.shift_id ?? "",
        e.kind, e.kind === "payment" ? e.amount : "0.00", e.kind === "refund" ? e.amount : "0.00",
        (Number(e.amount) * (e.kind === "refund" ? -1 : 1)).toFixed(2), e.cash, e.momo, e.unallocated,
      ]);
      const csvContent = [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");

      return NextResponse.json({ success: true, format, csvContent, recordCount: rows.length, timeframe, exportType: "collection-reconciliation", note: "Reconciliation ledger, not a certified QuickBooks/Xero import or tax return. Refund amounts are positive; net collection events carry the sign." });
    }

    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  } catch (err) {
    if (isDatabaseFailure(err)) throw err;
    if (err instanceof ApiError) throw err;
    console.error("Integration request failed:", err);
    return NextResponse.json({ error: "Request failed." }, { status: 500 });
  }
}

export const POST = secureRoute(handlePOST, "canViewReports");
