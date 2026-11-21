import { eq } from "drizzle-orm";
import { db } from "@/db";
import { kitchenTickets, orders } from "@/db/schema";

/**
 * Helpers for recording removals and cancels on orders (N3/N4 in
 * docs/FINDINGS.md). Until Nov 2026 these actions needed a manager's PIN once
 * the kitchen had the order; the owner turned that approval off, so they now
 * only describe what changed for the audit log. Refunds keep their own PIN
 * check in the refund route.
 */

/** True once the kitchen has the order: it left draft or has a docket. */
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
