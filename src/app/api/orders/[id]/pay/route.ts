import { secureRoute, isDatabaseFailure } from "@/lib/api";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { orders, payments, shifts, diningTables, auditLogs } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
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

/**
 * Identifies one tender request by the values the client sent, so a retry with
 * the same key replays and a *different* tender reusing that key is refused
 * instead of silently replaying the wrong money.
 */
function paymentFingerprint(input: {
  orderId: number;
  requestedCents: number | null;
  method: Tender;
  cashCents: number | null;
  momoCents: number | null;
  tenderedCents: number | null;
}): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

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
    const { amount, paymentMethod, cashTendered, referenceNumber, cashAmount, momoAmount, releaseTable, idempotencyKey } = body;

    if (idempotencyKey !== undefined && idempotencyKey !== null &&
        (typeof idempotencyKey !== "string" || idempotencyKey.length < 8 || idempotencyKey.length > 128)) {
      return NextResponse.json({ error: "Payment key must contain 8-128 characters" }, { status: 400 });
    }

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

      // Request-side values first: they are what the fingerprint is built from,
      // so a replay can be recognised without depending on the order's balance
      // (which the first attempt has already changed).
      const requestedCents = amount !== undefined && amount !== null && amount !== "" ? toCents(amount) : null;
      const requestCashCents = method === "split" ? toCents(cashAmount) : null;
      const requestMomoCents = method === "split" ? toCents(momoAmount) : null;
      const requestTenderedCents = cashTendered !== undefined && cashTendered !== null && cashTendered !== ""
        ? toCents(cashTendered)
        : null;
      const fingerprint = paymentFingerprint({
        orderId,
        requestedCents,
        method,
        cashCents: requestCashCents,
        momoCents: requestMomoCents,
        tenderedCents: requestTenderedCents,
      });

      // A retry of the same tender replays the original payment instead of
      // taking the money again. Checked before the balance checks: a replayed
      // full payment would otherwise be refused as "already fully paid", which
      // leaves the cashier unable to tell whether the money landed.
      if (idempotencyKey) {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`${guard.user.branchId}:pay:${idempotencyKey}`}, 0))`);
        const [existing] = await tx
          .select()
          .from(payments)
          .where(eq(payments.idempotencyKey, idempotencyKey))
          .limit(1);
        if (existing) {
          if (existing.requestFingerprint !== fingerprint) {
            return {
              error: "That payment key was already used for a different amount. Start a new payment instead of retrying.",
              status: 409,
            };
          }
          const batch = await tx
            .select()
            .from(payments)
            .where(and(eq(payments.orderId, orderId), eq(payments.createdAt, existing.createdAt)));
          const [fresh] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1);
          const replayedCents = batch.reduce((sum, row) => sum + toCents(row.amount), 0);
          const replayedChange = batch.reduce((sum, row) => sum + toCents(row.changeGiven || 0), 0);
          return {
            ok: true as const,
            replayed: true,
            payment: batch[0] ?? existing,
            payments: batch,
            order: fresh,
            changeGiven: fromCents(replayedChange),
            isFullyPaid: toCents(fresh.paidAmount) >= toCents(fresh.totalAmount),
            method,
            amount: fromCents(replayedCents),
          };
        }
      }

      const outstandingCents = toCents(order.totalAmount) - toCents(order.paidAmount);
      if (requestedCents !== null && requestedCents <= 0) {
        return { error: "Payment amount must be greater than zero.", status: 400 };
      }
      if (outstandingCents <= 0) return { error: "This order is already fully paid.", status: 409 };

      const payCents = requestedCents !== null ? requestedCents : outstandingCents;
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
        const cashCents = requestCashCents as number;
        const momoCents = requestMomoCents as number;
        if (!Number.isSafeInteger(cashCents) || !Number.isSafeInteger(momoCents) || cashCents <= 0 || momoCents <= 0) {
          return { error: "A split needs both a cash amount and a MoMo amount greater than zero.", status: 400 };
        }
        if (cashCents + momoCents !== payCents) {
          return {
            error: `Cash GH₵${fromCents(cashCents)} + MoMo GH₵${fromCents(momoCents)} must equal GH₵${fromCents(payCents)} exactly.`,
            status: 400,
          };
        }
        const tendered = requestTenderedCents !== null ? requestTenderedCents : cashCents;
        if (!Number.isSafeInteger(tendered) || tendered < cashCents) {
          return { error: "Cash handed over must cover the cash portion.", status: 400 };
        }
        lines.push({ method: "cash", cents: cashCents, reference: "CASH-PORTION", tenderedCents: tendered, changeCents: tendered - cashCents });
        lines.push({ method: "momo", cents: momoCents, reference: ref || "MOMO-PORTION", tenderedCents: null, changeCents: 0 });
      } else if (method === "cash") {
        const tendered = requestTenderedCents !== null ? requestTenderedCents : payCents;
        if (!Number.isSafeInteger(tendered) || tendered < payCents) {
          return { error: "Cash handed over does not cover the amount due.", status: 400 };
        }
        lines.push({ method: "cash", cents: payCents, reference: ref || "CASH-REGISTER", tenderedCents: tendered, changeCents: tendered - payCents });
      } else {
        lines.push({ method: "momo", cents: payCents, reference: ref || "MOMO", tenderedCents: null, changeCents: 0 });
      }

      // The money lands on the *operator's own* shift: with several staff
      // on duty, a sale must never swell a colleague's expected drawer cash.
      const shiftRows = await tx
        .select()
        .from(shifts)
        .where(and(eq(shifts.status, "open"), eq(shifts.userId, userId)))
        .orderBy(desc(shifts.openedAt))
        .limit(1)
        .for("update");
      const shift = shiftRows[0];
      if (!shift) return { error: "Open your shift before recording payment", status: 409 };

      const records = await tx
        .insert(payments)
        .values(
          lines.map((l, index) => ({
            orderId,
            shiftId: shift.id,
            amount: fromCents(l.cents),
            paymentMethod: l.method,
            referenceNumber: l.reference,
            cashTendered: l.tenderedCents !== null ? fromCents(l.tenderedCents) : null,
            changeGiven: l.method === "cash" ? fromCents(l.changeCents) : null,
            status: "completed",
            processedBy: userId,
            // One key per tender (a split writes two lines), stored on the first.
            idempotencyKey: index === 0 ? idempotencyKey || null : null,
            requestFingerprint: index === 0 ? fingerprint : null,
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
    if (isDatabaseFailure(err)) throw err;
    console.error("Recording payment failed:", err);
    return NextResponse.json({ error: "Could not record the payment. Please try again." }, { status: 500 });
  }
}

export const POST = secureRoute(handlePOST, "canAccessPos");
