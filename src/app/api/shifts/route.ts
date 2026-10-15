import { secureRoute, ApiError, isDatabaseFailure } from "@/lib/api";
import { moneyCents } from "@/lib/money";
import { NextResponse } from "next/server";
import { db, requestContext } from "@/db";
import { shifts, users, auditLogs, drawerMovements } from "@/db/schema";
import { requireSession } from "@/lib/guard";
import { eq, desc, inArray, and } from "drizzle-orm";

async function handleGET() {
  try {
    const allShifts = await db.select().from(shifts).orderBy(desc(shifts.openedAt)).limit(20);
    // Only the shifts on this page: their drawer movements and the people named on them.
    const shiftIds = allShifts.map((s) => s.id);
    const userIds = [...new Set(allShifts.flatMap((s) => [s.userId, s.reconciledBy])
      .filter((id): id is number => typeof id === "number"))];
    const movements = shiftIds.length
      ? await db.select().from(drawerMovements).where(inArray(drawerMovements.shiftId, shiftIds))
      : [];
    const allUsers = userIds.length ? await db.select().from(users).where(inArray(users.id, userIds)) : [];

    // Shifts are per staff member now: several can be open at once, one per
    // cashier. "activeShift" keeps meaning *the caller's own* open shift so
    // the till and the drawer screen keep working, and managers additionally
    // get every open shift to supervise and close.
    const actorId = requestContext.getStore()?.user?.id;
    const openShiftsRaw = allShifts.filter((s) => s.status === "open");
    const activeShift = openShiftsRaw.find((s) => s.userId === actorId) || null;

    const enrichedShifts = allShifts.map((s) => {
      const u = allUsers.find((usr) => usr.id === s.userId);
      const reconciler = s.reconciledBy ? allUsers.find((usr) => usr.id === s.reconciledBy) : null;
      return {
        ...s,
        cashRefunds: (movements.filter(m => m.shiftId === s.id && m.kind === "refund").reduce((sum, m) => sum + moneyCents(m.amount), 0) / 100).toFixed(2),
        userName: u?.name || "Unknown",
        reconciledByName: reconciler?.name,
      };
    });

    const myShift = activeShift
      ? {
          ...enrichedShifts.find(s => s.id === activeShift.id),
          userName: allUsers.find((u) => u.id === activeShift.userId)?.name,
        }
      : null;
    return NextResponse.json({
      activeShift: myShift,
      myShift,
      openShifts: openShiftsRaw.map((o) => enrichedShifts.find((e) => e.id === o.id)),
      history: enrichedShifts,
      drawerMovements: movements,
    });
  } catch (err: any) {
    if (isDatabaseFailure(err)) throw err;
    if (err instanceof ApiError) throw err;
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

      // One open shift per staff member (several colleagues may be on duty
      // at once, each accountable for their own float and cash sales).
      const [existing] = await db.select().from(shifts)
        .where(and(eq(shifts.status, "open"), eq(shifts.userId, Number(userId)))).limit(1);
      if (existing) {
        return NextResponse.json({ error: "You already have an open shift. Close it before opening another." }, { status: 400 });
      }

      const [newShift] = await db
        .insert(shifts)
        .values({
          branchId: requestContext.getStore()!.user!.branchId,
          userId: Number(userId || 1),
          openingCash: (moneyCents(openingCash, true) / 100).toFixed(2),
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
        details: `Opened register shift with GH₵${newShift.openingCash} opening cash float`,
      });

      return NextResponse.json({ success: true, shift: newShift });
    }

    if (action === "cash_payout") {
      const { shiftId, amount, reason } = body;
      const userId = sessionUserId;
      const [shift] = await db.select().from(shifts).where(eq(shifts.id, Number(shiftId))).limit(1).for("update");
      if (!shift) {
        return NextResponse.json({ error: "Shift not found" }, { status: 404 });
      }

      if (shift.status !== "open") throw new ApiError(409, "Shift is closed");
      if (shift.userId !== sessionUserId && !["manager", "super_admin"].includes(guard.user.role)) {
        throw new ApiError(403, "You can only record payouts on your own shift");
      }
      if (body.refundId !== undefined || body.kind === "refund") throw new ApiError(400, "Use the refund endpoint; linked cash outflows are recorded automatically");
      const payout = moneyCents(amount);
      if (typeof reason !== "string" || !reason.trim() || reason.length > 500) throw new ApiError(400, "Payout reason required");
      const newPayouts = (moneyCents(shift.cashPayouts || "0", true) + payout) / 100;
      await db.insert(drawerMovements).values({ shiftId: shift.id, kind: "payout", amount: (payout / 100).toFixed(2), reason: reason.trim(), createdBy: sessionUserId });
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
        details: `Cash drop/payout of GH₵${Number(amount).toFixed(2)}. Reason: ${reason || "N/A"}`,
      });

      return NextResponse.json({ success: true, shift: updated });
    }

    if (action === "close_shift") {
      const { shiftId, actualClosingCash, notes } = body;
      const reconciledBy = sessionUserId;
      const [shift] = await db.select().from(shifts).where(eq(shifts.id, Number(shiftId))).limit(1).for("update");
      if (!shift) {
        return NextResponse.json({ error: "Shift not found" }, { status: 404 });
      }

      if (shift.status !== "open") throw new ApiError(409, "Shift is already closed");
      const closingForSelf = shift.userId === sessionUserId;
      if (!closingForSelf && !["manager", "super_admin"].includes(guard.user.role)) {
        throw new ApiError(403, "Only the cashier who opened a shift, or a manager, can close it");
      }
      const opening = moneyCents(shift.openingCash, true);
      const cashSales = moneyCents(shift.totalCashSales || "0", true);
      const payouts = moneyCents(shift.cashPayouts || "0", true);
      const expectedCash = opening + cashSales - payouts;
      const counted = moneyCents(actualClosingCash, true);
      const diff = counted - expectedCash;

      const [closedShift] = await db
        .update(shifts)
        .set({
          closedAt: new Date(),
          expectedClosingCash: (expectedCash / 100).toFixed(2),
          actualClosingCash: (counted / 100).toFixed(2),
          cashDifference: (diff / 100).toFixed(2),
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
        details: `${closingForSelf ? "Closed shift" : `Closed shift for cashier #${shift.userId}`}. Counted: GH₵${(counted / 100).toFixed(2)}, Expected: GH₵${(expectedCash / 100).toFixed(2)}, Diff: ${diff >= 0 ? "+" : ""}GH₵${(diff / 100).toFixed(2)}`,
      });

      return NextResponse.json({ success: true, shift: closedShift, difference: (diff / 100).toFixed(2) });
    }

    if (action === "open_drawer") {
      const { shiftId, reason } = body;
      const [shift] = shiftId
        ? await db.select().from(shifts).where(eq(shifts.id, Number(shiftId))).limit(1)
        : await db.select().from(shifts).where(and(eq(shifts.status, "open"), eq(shifts.userId, sessionUserId))).limit(1);
      if (!shift || shift.status !== "open") {
        return NextResponse.json({ error: "No open shift — open your shift first" }, { status: 400 });
      }

      await db.insert(auditLogs).values({
        userId: sessionUserId,
        userName: guard.user.name,
        action: "drawer_opened",
        entityType: "shift",
        entityId: String(shift.id),
        details: `Cash drawer opened (no sale) by ${guard.user.name}. Reason: ${reason || "Manual open"}`,
      });

      return NextResponse.json({ success: true, message: "Drawer-open request logged. Open the physical drawer using your local hardware controls." });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    if (isDatabaseFailure(err)) throw err;
    if (err instanceof ApiError) throw err;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const GET = secureRoute(handleGET, "canViewDrawerHistory");

export const POST = secureRoute(handlePOST, "canAccessPos");
