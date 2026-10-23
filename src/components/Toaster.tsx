"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle, X } from "lucide-react";
import { subscribeNotices, type Notice } from "@/lib/notify";

const TONE = {
  ok: { icon: CheckCircle2, cls: "bg-emerald-500/15 border-emerald-500/40 text-emerald-200" },
  warn: { icon: AlertTriangle, cls: "bg-amber-500/15 border-amber-500/40 text-amber-100" },
  error: { icon: XCircle, cls: "bg-rose-500/15 border-rose-500/40 text-rose-100" },
} as const;

/**
 * Notices stack above the phone tab bar (and the cart bar) so nothing is ever
 * covered by the controls a cashier is using. Each one clears itself; a tap
 * dismisses it sooner.
 */
export function Toaster() {
  const [notices, setNotices] = useState<Notice[]>([]);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const unsubscribe = subscribeNotices((notice) => {
      setNotices((current) => [...current.slice(-2), notice]);
      timers.push(
        setTimeout(() => setNotices((current) => current.filter((n) => n.id !== notice.id)), 7000)
      );
    });
    return () => {
      unsubscribe();
      timers.forEach(clearTimeout);
    };
  }, []);

  if (notices.length === 0) return null;

  // Sits above the dialogs (z-120) so a result is never hidden, but the card
  // itself is click-through: a notice may never eat the tap that was meant for
  // the button underneath it. Only the dismiss button takes input.
  //
  // Phones hang notices from the top, just under the bar: the bottom edge of
  // a phone already carries the tab bar and, on the till, the Open Order bar
  // with the running total — the one number a cashier must never lose under
  // a toast. Tablets/desktops keep the bottom-right corner as before.
  return (
    <div className="fixed inset-x-0 top-[calc(env(safe-area-inset-top,0px)+5.25rem)] bottom-auto md:top-auto md:bottom-4 z-[140] px-3 md:px-0 md:right-4 md:left-auto md:w-[380px] md:max-w-full flex flex-col gap-2 pointer-events-none">
      {notices.map((notice) => {
        const { icon: Icon, cls } = TONE[notice.tone];
        return (
          <div
            key={notice.id}
            className={`pointer-events-none flex items-start gap-2.5 px-4 py-3 rounded-2xl border backdrop-blur shadow-2xl ${cls}`}
            role="status"
          >
            <Icon className="w-5 h-5 shrink-0 mt-0.5" />
            <span className="flex-1 text-sm font-semibold leading-snug">{notice.text}</span>
            {notice.actionLabel && notice.onAction && (
              <button
                onClick={() => {
                  notice.onAction?.();
                  setNotices((current) => current.filter((n) => n.id !== notice.id));
                }}
                className="pointer-events-auto shrink-0 px-3 py-2 -my-1 rounded-lg bg-white/15 hover:bg-white/25 font-black text-xs uppercase tracking-wide"
              >
                {notice.actionLabel}
              </button>
            )}
            <button
              onClick={() => setNotices((current) => current.filter((n) => n.id !== notice.id))}
              className="pointer-events-auto shrink-0 -mr-1 p-2 -my-1 rounded-lg hover:bg-white/10"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
