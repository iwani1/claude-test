import { secureRoute } from "@/lib/api";
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

    const { action, format } = await req.json();

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

      const orderList = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(1000);
      const headers = ["TransactionID", "Date", "Description", "GrossAmount(GHS)", "GRA_VAT(GHS)", "Discount(GHS)", "PaymentStatus", "AccountCode"];
      const rows = orderList.map((o) => [
        o.orderNumber,
        new Date(o.createdAt).toISOString().split("T")[0],
        `Asanka Royal Restaurant Sale - ${o.customerName} (${o.orderType})`,
        o.totalAmount,
        o.taxAmount,
        o.discountAmount,
        o.paymentStatus,
        format === "xero" ? "200 - Food & Beverage Revenue" : "4000 - Restaurant Sales GH",
      ]);
      const csvContent = [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");

      return NextResponse.json({ success: true, format, csvContent, recordCount: rows.length });
    }

    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  } catch (err) {
    console.error("Integration request failed:", err);
    return NextResponse.json({ error: "Request failed." }, { status: 500 });
  }
}

export const POST = secureRoute(handlePOST, "canViewReports");
