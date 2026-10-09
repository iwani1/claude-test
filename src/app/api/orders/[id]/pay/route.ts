import { secureRoute } from "@/lib/api";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { orders, payments, shifts, diningTables, auditLogs } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireSession } from "@/lib/guard";

/**
 * Records a payment that staff have already collected: Cash, MoMo, or a
 * Cash + MoMo split. There is no payment gateway - MoMo is simply noted by
 * the cashier - so this route only has to guarantee the books stay correct.
 *
 * Integrity guarantees:
 *  - The order row is locked (SELECT ... FOR UPDATE), so two simultaneous
 *    requests cannot both pay the same balance.
 *  - Payment rows, order balance, shift totals, table release and the audit
 *    entry commit together or not at all (one transaction).
 *  - All arithmetic is in integer pesewas, avoiding float drift.
 *  - A split must add up EXACTLY to the amount being settled, and the amount
 *    can never exceed what is still owed.
 */

const toCents = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
};
const fromCents = (c: number): string => (c / 100).toFixed(2);

type Tender = "cash" | "momo" | "split";

async function handlePOST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireSession();
    if (!guard.ok) return guard.response;

    const { id } = await params;
    const orderId = Number(id);
    if (!Number.isSafeInteger(orderId) || orderId <= 0) {
      return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
    }

    const body = await req.json();
    const { amount, paymentMethod, cashTendered, referenceNumber, cashAmount, momoAmount, releaseTable } = body;

    if (paymentMethod !== "cash" && paymentMethod !== "momo" && paymentMethod !== "split") {
      return NextResponse.json(
        { error: "Payment must be recorded as Cash, MoMo, or a Cash + MoMo split." },
        { status: 400 }
      );
    }
    const method: Tender = paymentMethod;
    const userId = guard.user.id;
    const ref = typeof referenceNumber === "string" ? referenceNumber.trim() : "";

    const result = await db.transaction(async (tx) => {
      const locked = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1).for("update");
      const order = locked[0];
      if (!order) return { error: "Order not found", status: 404 };

      if (order.status === "cancelled" || order.status === "refunded" || order.paymentStatus.includes("refunded")) {
        return { error: "This order is cancelled or refunded and cannot be paid.", status: 409 };
      }

      const outstandingCents = toCents(order.totalAmount) - toCents(order.paidAmount);
      if (outstandingCents <= 0) return { error: "This order is already fully paid.", status: 409 };

      const payCents = amount !== undefined && amount !== null && amount !== "" ? toCents(amount) : outstandingCents;
      if (!Number.isSafeInteger(payCents) || payCents <= 0) {
        return { error: "Payment amount must be greater than zero.", status: 400 };
      }
      if (payCents > outstandingCents) {
        return {
          error: `Payment of GH₵${fromCents(payCents)} is more than the GH₵${fromCents(outstandingCents)} still owed.`,
          status: 400,
        };
      }

      // Work out the ledger lines for this tender.
      const lines: {
        method: "cash" | "momo";
        cents: number;
        reference: string;
        tenderedCents: number | null;
        changeCents: number;
      }[] = [];

      if (method === "split") {
        const cashCents = toCents(cashAmount);
        const momoCents = toCents(momoAmount);
        if (!Number.isSafeInteger(cashCents) || !Number.isSafeInteger(momoCents) || cashCents <= 0 || momoCents <= 0) {
          return { error: "A split needs both a cash amount and a MoMo amount greater than zero.", status: 400 };
        }
        if (cashCents + momoCents !== payCents) {
          return {
            error: `Cash GH₵${fromCents(cashCents)} + MoMo GH₵${fromCents(momoCents)} must equal GH₵${fromCents(payCents)} exactly.`,
            status: 400,
          };
        }
        const tendered = cashTendered ? toCents(cashTendered) : cashCents;
        if (!Number.isSafeInteger(tendered) || tendered < cashCents) {
          return { error: "Cash handed over must cover the cash portion.", status: 400 };
        }
        lines.push({ method: "cash", cents: cashCents, reference: "CASH-PORTION", tenderedCents: tendered, changeCents: tendered - cashCents });
        lines.push({ method: "momo", cents: momoCents, reference: ref || "MOMO-PORTION", tenderedCents: null, changeCents: 0 });
      } else if (method === "cash") {
        const tendered = cashTendered ? toCents(cashTendered) : payCents;
        if (!Number.isSafeInteger(tendered) || tendered < payCents) {
          return { error: "Cash handed over does not cover the amount due.", status: 400 };
        }
        lines.push({ method: "cash", cents: payCents, reference: ref || "CASH-REGISTER", tenderedCents: tendered, changeCents: tendered - payCents });
      } else {
        lines.push({ method: "momo", cents: payCents, reference: ref || "MOMO", tenderedCents: null, changeCents: 0 });
      }

      const records = await tx
        .insert(payments)
        .values(
          lines.map((l) => ({
            orderId,
            amount: fromCents(l.cents),
            paymentMethod: l.method,
            referenceNumber: l.reference,
            cashTendered: l.tenderedCents !== null ? fromCents(l.tenderedCents) : null,
            changeGiven: l.method === "cash" ? fromCents(l.changeCents) : null,
            status: "completed",
            processedBy: userId,
          }))
        )
        .returning();

      const paidCents = toCents(order.paidAmount) + payCents;
      const isFullyPaid = paidCents >= toCents(order.totalAmount);
      const [updatedOrder] = await tx
        .update(orders)
        .set({
          paidAmount: fromCents(paidCents),
          paymentStatus: isFullyPaid ? "paid" : "partially_paid",
          status: isFullyPaid ? "completed" : order.status,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId))
        .returning();

      // Shift totals: cash into the drawer total, MoMo into the digital total.
      const cashIn = lines.filter((l) => l.method === "cash").reduce((s, l) => s + l.cents, 0);
      const momoIn = lines.filter((l) => l.method === "momo").reduce((s, l) => s + l.cents, 0);
      const shiftRows = await tx
        .select()
        .from(shifts)
        .where(eq(shifts.status, "open"))
        .orderBy(desc(shifts.openedAt))
        .limit(1)
        .for("update");
      const shift = shiftRows[0];
      if (shift) {
        await tx
          .update(shifts)
          .set({
            totalSales: fromCents(toCents(shift.totalSales || 0) + payCents),
            totalCashSales: fromCents(toCents(shift.totalCashSales || 0) + cashIn),
            totalCardSales: fromCents(toCents(shift.totalCardSales || 0) + momoIn),
          })
          .where(eq(shifts.id, shift.id));
      }

      // Only free the table once the bill is actually settled.
      if (order.tableId && isFullyPaid && releaseTable !== false) {
        await tx
          .update(diningTables)
          .set({ status: "available", currentOrderId: null })
          .where(eq(diningTables.id, order.tableId));
      }

      const totalChange = lines.reduce((s, l) => s + l.changeCents, 0);
      const summary = lines.map((l) => `${l.method === "momo" ? "MoMo" : "Cash"} GH₵${fromCents(l.cents)}`).join(" + ");
      await tx.insert(auditLogs).values({
        userId,
        userName: guard.user.name,
        action: lines.length > 1 ? "split_payment_recorded" : "payment_recorded",
        entityType: "order",
        entityId: String(orderId),
        details: `${guard.user.name} recorded ${summary} for ${order.orderNumber}. Change given: GH₵${fromCents(totalChange)}.`,
      });

      return {
        ok: true as const,
        payment: records[0],
        payments: records,
        order: updatedOrder,
        changeGiven: fromCents(totalChange),
        isFullyPaid,
        method,
      };
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("Recording payment failed:", err);
    return NextResponse.json({ error: "Could not record the payment. Please try again." }, { status: 500 });
  }
}

export const POST = secureRoute(handlePOST, "canAccessPos");
