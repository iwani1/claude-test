"use client";

/**
 * Tiny in-app notice bus.
 *
 * The till used window.alert() for operational messages — offline queuing,
 * payment failures, sync results. A blocking modal is the worst possible
 * feedback on a phone mid-service: it steals the tap, cannot be read while
 * moving, and shows nothing once dismissed. These notices appear in the shell,
 * stack, and fade; the underlying state (queue count, offline banner) is what
 * carries the durable truth.
 */
export type NoticeTone = "ok" | "warn" | "error";

export interface Notice {
  id: number;
  text: string;
  tone: NoticeTone;
  /**
   * Optional single action (e.g. Undo) rendered on the notice. Only offer
   * one where the app can genuinely reverse the action — never for a
   * server-committed payment, refund or deletion.
   */
  actionLabel?: string;
  onAction?: () => void;
}

type Listener = (notice: Notice) => void;

const listeners = new Set<Listener>();
let nextId = 1;

export function notify(text: string, tone: NoticeTone = "warn") {
  if (!text) return;
  const notice: Notice = { id: nextId++, text, tone };
  listeners.forEach((listener) => listener(notice));
}

/** Notice with one real, reversible action (e.g. Undo a local cart edit). */
export function notifyWithAction(
  text: string,
  actionLabel: string,
  onAction: () => void,
  tone: NoticeTone = "warn",
) {
  if (!text) return;
  const notice: Notice = { id: nextId++, text, tone, actionLabel, onAction };
  listeners.forEach((listener) => listener(notice));
}

export function subscribeNotices(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
