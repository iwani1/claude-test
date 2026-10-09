import { secureRoute } from "@/lib/api";
import { NextResponse } from "next/server";
import { db, requestContext } from "@/db";
import { shifts, users, auditLogs } from "@/db/schema";
import { requireSession } from "@/lib/guard";
import { eq, desc } from "drizzle-orm";

async function handleGET() {
  try {
    const allShifts = await db.select().from(shifts).orderBy(desc(shifts.openedAt)).limit(20);
    const allUsers = await db.select().from(users);

    const activeShift = allShifts.find((s) => s.status === "open") || null;

    const enrichedShifts = allShifts.map((s) => {
      const u = allUsers.find((usr) => usr.id === s.userId);
      const reconciler = s.reconciledBy ? allUsers.find((usr) => usr.id === s.reconciledBy) : null;
      return {
        ...s,
        userName: u?.name || "Unknown",
        reconciledByName: reconciler?.name,
      };
    });

    return NextResponse.json({
      activeShift: activeShift
        ? {
            ...activeShift,
            userName: allUsers.find((u) => u.id === activeShift.userId)?.name,
          }
        : null,
      history: enrichedShifts,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function handlePOST(req: Request) {
  try {
    // Cash drawer operations are always tied to the authenticated operator.
    const guard = await requireSession();
    if (!guard.ok) return guard.response;
    const sessionUserId = guard.user.id;

    const body = await req.json();
    const { action } = body;

    if (action === "open_shift") {
      const { branchId, openingCash, notes } = body;
      const userId = sessionUserId;

      // Check if open shift already exists
      const [existing] = await db.select().from(shifts).where(eq(shifts.status, "open")).limit(1);
      if (existing) {
        return NextResponse.json({ error: "There is already an active open shift on this register" }, { status: 400 });
      }

      const [newShift] = await db
        .insert(shifts)
        .values({
          branchId: requestContext.getStore()!.user!.branchId,
          userId: Number(userId || 1),
          openingCash: String(openingCash || "200.00"),
          totalSales: "0.00",
          totalCashSales: "0.00",
          totalCardSales: "0.00",
          cashPayouts: "0.00",
          status: "open",
          notes: notes || "Shift opened",
        })
        .returning();

      await db.insert(auditLogs).values({
        userId: Number(userId || 1),
        action: "shift_opened",
        entityType: "shift",
        entityId: String(newShift.id),
        details: `Opened register shift with $${newShift.openingCash} opening cash float`,
      });

      return NextResponse.json({ success: true, shift: newShift });
    }

    if (action === "cash_payout") {
      const { shiftId, amount, reason } = body;
      const userId = sessionUserId;
      const [shift] = await db.select().from(shifts).where(eq(shifts.id, Number(shiftId))).limit(1);
      if (!shift) {
        return NextResponse.json({ error: "Shift not found" }, { status: 404 });
      }

      const newPayouts = Number(shift.cashPayouts || 0) + Number(amount);
      const [updated] = await db
        .update(shifts)
        .set({ cashPayouts: newPayouts.toFixed(2) })
        .where(eq(shifts.id, shift.id))
        .returning();

      await db.insert(auditLogs).values({
        userId: userId || 1,
        action: "cash_payout",
        entityType: "shift",
        entityId: String(shift.id),
        details: `Cash drop/payout of $${Number(amount).toFixed(2)}. Reason: ${reason || "N/A"}`,
      });

      return NextResponse.json({ success: true, shift: updated });
    }

    if (action === "close_shift") {
      const { shiftId, actualClosingCash, notes } = body;
      const reconciledBy = sessionUserId;
      const [shift] = await db.select().from(shifts).where(eq(shifts.id, Number(shiftId))).limit(1);
      if (!shift) {
        return NextResponse.json({ error: "Shift not found" }, { status: 404 });
      }

      const opening = Number(shift.openingCash);
      const cashSales = Number(shift.totalCashSales || 0);
      const payouts = Number(shift.cashPayouts || 0);
      const expectedCash = opening + cashSales - payouts;
      const counted = Number(actualClosingCash || 0);
      const diff = counted - expectedCash;

      const [closedShift] = await db
        .update(shifts)
        .set({
          closedAt: new Date(),
          expectedClosingCash: expectedCash.toFixed(2),
          actualClosingCash: counted.toFixed(2),
          cashDifference: diff.toFixed(2),
          status: "closed",
          notes: notes || "Shift closed and reconciled",
          reconciledBy: Number(reconciledBy || 1),
        })
        .where(eq(shifts.id, shift.id))
        .returning();

      await db.insert(auditLogs).values({
        userId: reconciledBy,
        userName: guard.user.name,
        action: "shift_closed",
        entityType: "shift",
        entityId: String(shift.id),
        details: `Closed shift. Counted: $${counted.toFixed(2)}, Expected: $${expectedCash.toFixed(2)}, Diff: ${diff >= 0 ? "+" : ""}$${diff.toFixed(2)}`,
      });

      return NextResponse.json({ success: true, shift: closedShift, difference: diff.toFixed(2) });
    }

    if (action === "open_drawer") {
      const { shiftId, reason } = body;
      const [shift] = shiftId
        ? await db.select().from(shifts).where(eq(shifts.id, Number(shiftId))).limit(1)
        : await db.select().from(shifts).where(eq(shifts.status, "open")).limit(1);
      if (!shift) {
        return NextResponse.json({ error: "No open shift — open the register first" }, { status: 400 });
      }

      await db.insert(auditLogs).values({
        userId: sessionUserId,
        userName: guard.user.name,
        action: "drawer_opened",
        entityType: "shift",
        entityId: String(shift.id),
        details: `Cash drawer opened (no sale) by ${guard.user.name}. Reason: ${reason || "Manual open"}`,
      });

      return NextResponse.json({ success: true, message: "Drawer open signal sent" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const GET = secureRoute(handleGET, "canAccessPos");

export const POST = secureRoute(handlePOST, "canAccessPos");
