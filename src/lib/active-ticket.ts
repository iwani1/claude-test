/**
 * The open ticket lives inside the till component, but the till unmounts
 * whenever staff tap another screen (Tables, Orders, Drawer, sidebar), and
 * the global "New Order" buttons can wipe it from outside. This module keeps
 * the ticket as a per-staff draft:
 *
 *  - tapping away and back restores the ticket untouched;
 *  - an unexpected restart no longer loses a half-taken order;
 *  - the global "New Order" buttons read the draft to warn first;
 *  - the draft expires after 12 hours so yesterday's ticket does not
 *    reappear on the next morning shift.
 *
 * A ticket can also belong to an order that already exists on the server —
 * one that was sent to the kitchen and later reopened to add items or take
 * payment. The draft then records that order's id, so the till re-attaches
 * to the same bill after a screen change or restart instead of ringing the
 * food a second time.
 */
const DRAFT_TTL_MS = 12 * 60 * 60 * 1000;

const draftKey = (userId: string | number) => `pos.ticketDraft.${userId}`;

export function saveTicketDraft(userId: string | number, items: unknown[], orderId: number | null = null) {
  try {
    if (items.length === 0) window.localStorage.removeItem(draftKey(userId));
    else window.localStorage.setItem(draftKey(userId), JSON.stringify({ savedAt: Date.now(), items, orderId }));
  } catch {
    /* audit-ok: storage unavailable — the ticket lives in memory for this session */
  }
}

export function readTicketDraft<T>(userId: string | number): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(draftKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { savedAt?: number; items?: unknown };
    const items = Array.isArray(parsed?.items) ? (parsed.items as T[]) : [];
    const fresh = typeof parsed?.savedAt === "number" && Date.now() - parsed.savedAt < DRAFT_TTL_MS;
    if (!fresh) {
      window.localStorage.removeItem(draftKey(userId));
      return [];
    }
    return items;
  } catch {
    /* audit-ok: unreadable draft — an empty ticket is the safe answer */
    return [];
  }
}

/** The server order a parked ticket belongs to, if it belongs to one. */
export function readTicketDraftOrderId(userId: string | number): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(draftKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt?: number; orderId?: unknown };
    const fresh = typeof parsed?.savedAt === "number" && Date.now() - parsed.savedAt < DRAFT_TTL_MS;
    if (!fresh) return null;
    const id = Number(parsed?.orderId);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  } catch {
    /* audit-ok: unreadable draft — no order attachment */
    return null;
  }
}

export function clearTicketDraft(userId: string | number) {
  try {
    window.localStorage.removeItem(draftKey(userId));
  } catch {
    /* audit-ok: nothing to clear */
  }
}
