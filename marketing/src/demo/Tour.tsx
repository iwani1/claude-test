"use client";

import { motion } from "motion/react";
import { ArrowRight, Check, ChevronRight, X } from "lucide-react";
import { useDemo, type Action, type State } from "./store";
import { Btn, T } from "./ui";

type Step = { id: string; title: string; body: string; done: (s: State) => boolean; go: Action[] };

const userOrders = (s: State) => s.orders.filter((o) => o.number >= s.firstUserNumber);

export const STEPS: Step[] = [
  {
    id: "order",
    title: "Open a table and build an order",
    body: "On the Till, tap T7, then add a Jollof & Chicken and a Sobolo. Try the note icon on a line — the kitchen sees it verbatim.",
    done: (s) => userOrders(s).some((o) => o.lines.reduce((n, l) => n + l.qty, 0) >= 2),
    go: [{ type: "selectTable", tableId: "t7" }],
  },
  {
    id: "send",
    title: "Send it to the kitchen",
    body: "Press Send. Only kitchen items fire — the Sobolo stays on the bill but never prints in the kitchen.",
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
    body: "Back on the Till, open T7 and press Charge. Pick a network and send the prompt; the receipt prints when the customer approves.",
    done: (s) => userOrders(s).some((o) => o.payment?.method === "momo"),
    go: [{ type: "selectTable", tableId: "t7" }],
  },
  {
    id: "offline",
    title: "Sell through a network drop",
    body: "Flip the switch in the top bar to Offline, sell a Sobolo at the Bar for cash, then go back Online and watch it sync.",
    done: (s) => s.syncedAfterOffline,
    go: [{ type: "selectTable", tableId: "bar" }, { type: "toast", text: "Now flip Online → Offline in the top bar", tone: "info" }],
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

export function Tour({ onClose }: { onClose?: () => void }) {
  const { dispatch } = useDemo();
  const { done, count, current, total } = useTourProgress();
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3 px-4 pt-4">
        <div>
          <p className={`text-[.68rem] font-semibold uppercase tracking-[.18em] ${T.mint}`}>Run the shift</p>
          <p className="mt-1 font-serif text-xl italic text-emerald-100">Six things a till does every night.</p>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Hide guide" className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border ${T.line} ${T.muted} hover:text-white`}>
            <X size={15} />
          </button>
        )}
      </div>
      <div className="px-4 pt-3">
        <div className="flex items-center justify-between text-xs">
          <span className={T.muted}>
            {count} of {total} done
          </span>
          <span className={T.muted}>{count === total ? "✦ full shift" : `~${Math.max(1, (total - count) * 1)} min left`}</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
          <motion.div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-amber-300" initial={false} animate={{ width: `${(count / total) * 100}%` }} transition={{ duration: 0.6, ease: [0.2, 0.7, 0.2, 1] }} />
        </div>
      </div>

      <ol className="mt-3 min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 pb-3">
        {STEPS.map((st, i) => {
          const isDone = done[i];
          const isCurrent = i === current;
          return (
            <li key={st.id} className={`rounded-xl border p-3 transition-colors ${isCurrent ? "border-emerald-400/40 bg-emerald-400/[.08]" : isDone ? "border-emerald-50/[.06] bg-white/[.02]" : `${T.line} bg-white/[.02]`}`}>
              <div className="flex items-start gap-2.5">
                <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[.65rem] font-black ${isDone ? "bg-emerald-400 text-emerald-950" : isCurrent ? "border border-emerald-300 text-emerald-200" : `border ${T.line} ${T.muted}`}`}>
                  {isDone ? <Check size={11} strokeWidth={3.5} /> : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold ${isDone ? "text-emerald-100/70 line-through decoration-emerald-400/40" : ""}`}>{st.title}</p>
                  {isCurrent && <p className={`mt-1 text-xs leading-relaxed ${T.muted}`}>{st.body}</p>}
                  {isCurrent && (
                    <button
                      type="button"
                      onClick={() => {
                        st.go.forEach((a) => dispatch(a));
                        onClose?.();
                      }}
                      className={`mt-2 inline-flex items-center gap-1 text-xs font-bold ${T.mint} hover:text-emerald-200`}
                    >
                      Take me there <ChevronRight size={13} />
                    </button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <div className={`border-t ${T.line} p-3`}>
        {count === total ? (
          <a href="/orbs/#pricing" className="flex items-center justify-between rounded-xl bg-emerald-400 px-4 py-3 text-sm font-bold text-emerald-950 hover:bg-emerald-300">
            That was a whole shift. Get it for your venue <ArrowRight size={15} />
          </a>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <p className={`text-xs ${T.muted}`}>Nothing here is real — reset any time.</p>
            <Btn size="sm" onClick={() => dispatch({ type: "reset" })}>
              Reset demo
            </Btn>
          </div>
        )}
      </div>
    </div>
  );
}
