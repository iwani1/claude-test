"use client";

import { motion } from "motion/react";
import { useDemo, type Action, type State } from "./store";
import { Caps, K, Pill, TextLink } from "./ui";

type Step = { id: string; title: string; body: string; done: (s: State) => boolean; go: Action[] };

const userOrders = (s: State) => s.orders.filter((o) => o.number >= s.firstUserNumber);

export const STEPS: Step[] = [
  {
    id: "order",
    title: "Open a table and build an order",
    body: "On the Till, tap 07 in the table strip, then add a Jollof & Chicken and a Sobolo. Try “note” under a line — the kitchen sees it verbatim.",
    done: (s) => userOrders(s).some((o) => o.lines.reduce((n, l) => n + l.qty, 0) >= 2),
    go: [{ type: "selectTable", tableId: "t7" }],
  },
  {
    id: "send",
    title: "Send it to the kitchen",
    body: "Use “Send … to the kitchen” under the total. Only kitchen items fire — the Sobolo stays on the bill but never prints in the kitchen.",
    done: (s) => s.tickets.some((t) => t.number >= s.firstUserNumber),
    go: [{ type: "screen", screen: "till" }],
  },
  {
    id: "pass",
    title: "Work the pass",
    body: "In Kitchen, Start prep on your ticket, then Mark ready. Timers turn amber after 8 minutes and red after 15 — the same thresholds as the real KDS.",
    done: (s) => s.tickets.some((t) => t.number >= s.firstUserNumber && (t.status === "ready" || t.status === "completed")),
    go: [{ type: "screen", screen: "kitchen" }],
  },
  {
    id: "momo",
    title: "Charge the table with Mobile Money",
    body: "Back on the Till, open 07 and press Charge. Pick a network and send the prompt; the receipt prints when the customer approves.",
    done: (s) => userOrders(s).some((o) => o.payment?.method === "momo"),
    go: [{ type: "selectTable", tableId: "t7" }],
  },
  {
    id: "offline",
    title: "Sell through a network drop",
    body: "Click Online in the header to go Offline, sell a Sobolo at the Bar for cash, then go back Online and watch it sync.",
    done: (s) => s.syncedAfterOffline,
    go: [{ type: "selectTable", tableId: "bar" }, { type: "toast", text: "Now click “Online” in the header to drop the network", tone: "info" }],
  },
  {
    id: "close",
    title: "Close the shift",
    body: "Open Drawer, settle anything still open, then End shift. Type the counted cash — try the exact figure first, then GH₵ 20 short.",
    done: (s) => Boolean(s.shift.closedAt),
    go: [{ type: "screen", screen: "drawer" }],
  },
];

export function useTourProgress() {
  const { state } = useDemo();
  const done = STEPS.map((st) => st.done(state));
  const count = done.filter(Boolean).length;
  const current = done.findIndex((d) => !d);
  return { done, count, current, total: STEPS.length };
}

export function Tour({ onClose, embedded = false }: { onClose?: () => void; embedded?: boolean }) {
  const { dispatch } = useDemo();
  const { done, count, current, total } = useTourProgress();
  return (
    <div className="flex h-full flex-col">
      <div className="px-8 pt-7">
        {!embedded && (
          <div className="flex items-start justify-between gap-3">
            <div>
              <Caps tone="accent">Run the shift</Caps>
              <p className="mt-2 font-serif text-[24px] italic leading-tight tracking-[-.01em]">Six things a till does every night.</p>
            </div>
            {onClose && (
              <button type="button" onClick={onClose} aria-label="Hide guide" className={`mt-1 text-sm ${K.fg3} hover:text-(--fg)`}>
                Hide
              </button>
            )}
          </div>
        )}
        <div className={`${embedded ? "" : "mt-6"} flex items-baseline justify-between text-xs ${K.fg3}`}>
          <span>
            <span className="font-serif lining text-[16px] text-(--fg)">{count}</span> of {total}
          </span>
          <span>{count === total ? "a full shift" : `about ${Math.max(1, total - count)} min left`}</span>
        </div>
        <div className="mt-2 h-px bg-(--line)">
          <motion.div className="h-full bg-(--accent)" initial={false} animate={{ width: `${(count / total) * 100}%` }} transition={{ duration: 0.6, ease: [0.2, 0.7, 0.2, 1] }} />
        </div>
      </div>

      <ol className="no-bar mt-4 min-h-0 flex-1 overflow-y-auto px-8">
        {STEPS.map((st, i) => {
          const isDone = done[i];
          const isCurrent = i === current;
          return (
            <li key={st.id} className={`border-b ${K.line2} py-4 last:border-b-0`}>
              <div className="flex items-start gap-4">
                <span className={`mt-px w-6 shrink-0 font-serif lining text-[18px] ${isDone ? K.accent : isCurrent ? K.fg : K.fg3}`}>{isDone ? "✓" : String(i + 1).padStart(2, "0")}</span>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${isDone ? `${K.fg3} line-through decoration-(--line)` : isCurrent ? "font-semibold text-(--fg)" : K.fg2}`}>{st.title}</p>
                  {isCurrent && (
                    <>
                      <p className={`mt-1.5 text-[13px] leading-relaxed ${K.fg2}`}>{st.body}</p>
                      <TextLink
                        className="mt-2.5"
                        onClick={() => {
                          st.go.forEach((a) => dispatch(a));
                          onClose?.();
                        }}
                      >
                        Take me there
                      </TextLink>
                    </>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <div className={`border-t ${K.line} px-8 py-5`}>
        {count === total ? (
          <a href="/orbs/#pricing" className="block">
            <Pill tone="accent" right="→" className="pointer-events-none">
              That was a whole shift. Get it
            </Pill>
          </a>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <p className={`text-xs ${K.fg3}`}>Nothing here is real.</p>
            <TextLink tone="fg3" arrow={false} onClick={() => dispatch({ type: "reset" })}>
              Reset demo
            </TextLink>
          </div>
        )}
      </div>
    </div>
  );
}
