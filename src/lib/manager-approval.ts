import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, requestContext } from "@/db";
import { users, kitchenTickets, orders } from "@/db/schema";
import { APPROVER_PIN_MESSAGE, APPROVER_PIN_MIN_LENGTH, effectivePermissions, pinDigest, verifyPasswordAsync, type UserRole } from "./auth";
import { assertNotThrottled, BRANCH_PIN_BACKSTOP, recordFailedAttempt } from "./api";

/** Error codes the till recognises: it asks for a manager's PIN and retries. */
export const APPROVAL_REQUIRED = "manager_approval_required";
export const APPROVAL_INVALID = "manager_approval_invalid";

export type ManagerApproval =
  | { ok: true; manager: { id: number; name: string } }
  | { ok: false; response: NextResponse };

/**
 * A manager (or the owner) authorises a sensitive till action by typing their
 * PIN on the device. Row security limits the lookup to the caller's branch.
 * Wrong PINs are throttled per branch, outside the request transaction, so a
 * refused attempt still counts.
 *
 * The answer is a ready response with a machine-readable `code`, so the till
 * can tell "ask for a PIN" apart from any other refusal.
 */
export async function verifyManagerApproval(managerPin: unknown, reason: string): Promise<ManagerApproval> {
  const actor = requestContext.getStore()!.user!;
  // Wrong PINs count against the person asking (N13) and a branch-wide backstop.
  const key = `manager-approval:user:${actor.id}`;
  const branchKey = `manager-approval:branch:${actor.branchId}`;
  if (managerPin === undefined || managerPin === null || managerPin === "") {
    return { ok: false, response: NextResponse.json({ error: `${reason} needs a manager's PIN.`, code: APPROVAL_REQUIRED }, { status: 403 }) };
  }
  await assertNotThrottled(key);
  await assertNotThrottled(branchKey, BRANCH_PIN_BACKSTOP);
  const refuse = async () => {
    await recordFailedAttempt(key);
    await recordFailedAttempt(branchKey);
    return { ok: false as const, response: NextResponse.json({ error: "That PIN cannot approve this. Ask a manager to enter theirs.", code: APPROVAL_INVALID }, { status: 403 }) };
  };
  if (typeof managerPin !== "string" || !/^\d{4,8}$/.test(managerPin)) return refuse();
  // No approver may have a PIN under 6 digits (N19), so a shorter one is refused
  // before any lookup: it can reveal nothing about anyone's PIN.
  if (managerPin.length < APPROVER_PIN_MIN_LENGTH) {
    await recordFailedAttempt(key);
    await recordFailedAttempt(branchKey);
    return { ok: false, response: NextResponse.json({ error: APPROVER_PIN_MESSAGE, code: APPROVAL_INVALID }, { status: 403 }) };
  }
  const [manager] = await db.select().from(users).where(eq(users.pinLookup, pinDigest(managerPin)));
  // Whose PIN may approve is the owner's per-person choice (canApproveVoids, N6).
  if (!manager?.isActive || !effectivePermissions(manager.role as UserRole, manager.permissionOverrides).canApproveVoids || !manager.pin || !(await verifyPasswordAsync(managerPin, manager.pin))) return refuse();
  return { ok: true, manager: { id: manager.id, name: manager.name } };
}

/** An order has reached the kitchen once it left draft or has a docket. */
export async function orderSentToKitchen(order: typeof orders.$inferSelect): Promise<boolean> {
  if (order.status !== "draft") return true;
  const [ticket] = await db.select({ id: kitchenTickets.id }).from(kitchenTickets).where(eq(kitchenTickets.orderId, order.id)).limit(1);
  return !!ticket;
}

/** Order lines compared by dish and chosen options. */
export function lineKey(menuItemId: number, modifiers: unknown): string {
  const ids = Array.isArray(modifiers) ? modifiers.map((m: any) => Number(m?.id)).filter(Number.isFinite).sort((a, b) => a - b) : [];
  return `${menuItemId}|${ids.join(",")}`;
}

/** What an edit takes away: every line whose quantity drops or disappears. */
export function removedLines(
  before: { menuItemId: number; itemName: string; quantity: number; modifiers: unknown }[],
  after: { menuItemId: number; quantity: number; modifiers: unknown }[],
): { name: string; quantity: number }[] {
  const next = new Map<string, number>();
  for (const line of after) next.set(lineKey(line.menuItemId, line.modifiers), (next.get(lineKey(line.menuItemId, line.modifiers)) || 0) + line.quantity);
  const prev = new Map<string, { name: string; quantity: number }>();
  for (const line of before) {
    const key = lineKey(line.menuItemId, line.modifiers);
    const entry = prev.get(key) || { name: line.itemName, quantity: 0 };
    entry.quantity += line.quantity;
    prev.set(key, entry);
  }
  const removed: { name: string; quantity: number }[] = [];
  for (const [key, entry] of prev) {
    const dropped = entry.quantity - (next.get(key) || 0);
    if (dropped > 0) removed.push({ name: entry.name, quantity: dropped });
  }
  return removed;
}

export const describeLines = (lines: { name: string; quantity: number }[]) => lines.map((l) => `${l.quantity}× ${l.name}`).join(", ");
