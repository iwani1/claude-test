"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { can, useDemo, type Action, type State } from "./store";
import { Caps, K, Pill, TextLink } from "./ui";

type Step = { id: string; chapter: string; title: string; body: string; done: (s: State) => boolean; go: (s: State) => Action[] };

const userOrders = (s: State) => s.orders.filter((o) => o.number >= s.firstUserNumber);
const asOwner = (s: State, perm: Parameters<typeof can>[1], then: Action[]): Action[] =>
  can(s, perm) ? then : [{ type: "signOut" }, { type: "toast", text: "That part of the system needs the owner or manager — sign in as Kofi (1111) or Efua (2222)", tone: "info" }];

export const STEPS: Step[] = [
  /* ------------------------------------------------- front of house */
  {
    id: "signin",
    chapter: "Front of house",
    title: "Sign in with a PIN",
    body: "Pick Kofi Mensah, the owner, and type 1111 on the keypad. Roles decide what the header shows — later you’ll come back as a cashier and watch the back office disappear.",
    done: (s) => s.flags.firstUser !== null,
    go: (s) => (s.userId ? [{ type: "signOut" }] : []),
  },
  {
    id: "order",
    chapter: "Front of house",
    title: "Open a table and build an order",
    body: "On the Till, tap 07 in the table strip, then add a Jollof & Chicken and a Sobolo. Try “note” under a line — the kitchen sees it verbatim.",
    done: (s) => userOrders(s).some((o) => o.lines.reduce((n, l) => n + l.qty, 0) >= 2),
    go: (s) => asOwner(s, "pos", [{ type: "selectTable", tableId: "t7" }]),
  },
  {
    id: "send",
    chapter: "Front of house",
    title: "Send it to the kitchen",
    body: "Use “Send … to the kitchen” under the total. Only kitchen items fire — the Sobolo stays on the bill but never prints in the kitchen. Stock for the Jollof leaves the store at this moment.",
    done: (s) => s.tickets.some((t) => t.number >= s.firstUserNumber),
    go: (s) => asOwner(s, "pos", [{ type: "selectTable", tableId: "t7" }]),
  },
  {
    id: "pass",
    chapter: "Front of house",
    title: "Work the pass",
    body: "In Kitchen, Start prep on your ticket, then Mark ready. Timers turn amber after 8 minutes and red after 15 — the same thresholds as the real KDS.",
    done: (s) => s.tickets.some((t) => t.number >= s.firstUserNumber && (t.status === "ready" || t.status === "completed")),
    go: (s) => asOwner(s, "kds", [{ type: "screen", screen: "kitchen" }]),
  },
  {
    id: "momo",
    chapter: "Front of house",
    title: "Charge the table with Mobile Money",
    body: "Back on the Till, open 07 and press Charge. Pick a network and send the prompt; the receipt prints when the customer approves. Try “Extras” first for a discount or a tip.",
    done: (s) => userOrders(s).some((o) => o.payment?.method === "momo"),
    go: (s) => asOwner(s, "pos", [{ type: "selectTable", tableId: "t7" }]),
  },
  {
    id: "offline",
    chapter: "Front of house",
    title: "Sell through a network drop",
    body: "Click Online in the header to go Offline, sell a Sobolo at the Bar for cash, then go back Online and watch it sync.",
    done: (s) => s.syncedAfterOffline,
    go: (s) => asOwner(s, "pos", [{ type: "selectTable", tableId: "bar" }, { type: "toast", text: "Now click “Online” in the header to drop the network", tone: "info" }]),
  },

  /* ----------------------------------------------------- back office */
  {
    id: "receive",
    chapter: "Back office",
    title: "Receive the chicken delivery",
    body: "Darko Farms’ van is here. In Stock → Purchasing, open PO-0417 with “Receive goods”, type the invoice number and confirm. Watch chicken jump off the low-stock list.",
    done: (s) => s.flags.poReceived,
    go: (s) => asOwner(s, "stock", [{ type: "screen", screen: "purchasing" }]),
  },
  {
    id: "eightysix",
    chapter: "Back office",
    title: "Take a dish off the menu",
    body: "In Menu, switch any dish to Off. It greys out on every till instantly — no reprinting menus, no shouting across the pass.",
    done: (s) => s.menu.some((m) => !m.available),
    go: (s) => asOwner(s, "menu", [{ type: "screen", screen: "menu" }]),
  },
  {
    id: "refund",
    chapter: "Back office",
    title: "Refund a bill",
    body: "In Orders, open any paid bill and press Refund. Pick a line, give a reason, confirm. A cashier can start a refund, but only a manager’s PIN (Efua · 2222) completes it — and it lands in the audit log either way.",
    done: (s) => s.flags.refunded,
    go: (s) => asOwner(s, "orders", [{ type: "screen", screen: "orders" }]),
  },
  {
    id: "settings",
    chapter: "Back office",
    title: "Change how the bill is built",
    body: "In Setup → Settings, change the receipt footer or the room-service charge and Save. The preview receipt on the right updates as you type; the next bill priced uses the new figures.",
    done: (s) => s.flags.settingsSaved,
    go: (s) => (can(s, "settings") ? [{ type: "screen", screen: "settings" }] : [{ type: "signOut" }, { type: "toast", text: "Settings is owner-only — sign in as Kofi (1111)", tone: "info" }]),
  },
  {
    id: "export",
    chapter: "Back office",
    title: "Export the day",
    body: "In Money → Reports, press “Export sales CSV” — a real file downloads, one row per bill with VAT, tips, tender and reference. The accountant never re-keys a thing.",
    done: (s) => s.flags.exported,
    go: (s) => asOwner(s, "reports", [{ type: "screen", screen: "reports" }]),
  },

  /* ------------------------------------------------------ end of day */
  {
    id: "close",
    chapter: "End of day",
    title: "Close the shift",
    body: "Open Drawer, settle anything still open, then End shift. Type the counted cash — try the exact figure first, then GH₵ 20 short.",
    done: (s) => s.flags.shiftClosed,
    go: (s) => asOwner(s, "drawer", [{ type: "screen", screen: "drawer" }]),
  },
  {
    id: "switch",
    chapter: "End of day",
    title: "Hand over to a cashier",
    body: "Sign out and come back as Ama (3333). The header shrinks to Till, Kitchen, Orders and Drawer; Stock, Money and Setup are simply not there.",
    done: (s) => s.flags.switchedRole,
    go: () => [{ type: "signOut" }],
  },
];

const CHAPTERS = [...new Set(STEPS.map((s) => s.chapter))];

export function useTourProgress() {
  const { state } = useDemo();
  const done = STEPS.map((st) => st.done(state));
  const count = done.filter(Boolean).length;
  const current = done.findIndex((d) => !d);
  return { done, count, current, total: STEPS.length };
}

export function Tour({ onClose, embedded = false }: { onClose?: () => void; embedded?: boolean }) {
  const { state, dispatch } = useDemo();
  const { done, count, current, total } = useTourProgress();
  const [peek, setPeek] = useState<number | null>(null);
  const openIndex = peek ?? current;
  return (
    <div className="flex h-full flex-col">
      <div className="px-8 pt-7">
        {!embedded && (
          <div className="flex items-start justify-between gap-3">
            <div>
              <Caps tone="accent">Run the whole system</Caps>
              <p className="mt-2 font-serif text-[24px] italic leading-tight tracking-[-.01em]">A night in thirteen steps.</p>
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
          <span>{count === total ? "the whole system" : `about ${Math.max(1, Math.round((total - count) * 1.2))} min left`}</span>
        </div>
        <div className="mt-2 h-px bg-(--line)">
          <motion.div className="h-full bg-(--accent)" initial={false} animate={{ width: `${(count / total) * 100}%` }} transition={{ duration: 0.6, ease: [0.2, 0.7, 0.2, 1] }} />
        </div>
      </div>

      <div className="no-bar mt-3 min-h-0 flex-1 overflow-y-auto px-8 pb-4">
        {CHAPTERS.map((ch) => (
          <section key={ch} className="mt-4 first:mt-2">
            <Caps className="block">{ch}</Caps>
            <ol className="mt-1">
              {STEPS.map((st, i) => ({ st, i }))
                .filter(({ st }) => st.chapter === ch)
                .map(({ st, i }) => {
                  const isDone = done[i];
                  const isOpen = i === openIndex;
                  return (
                    <li key={st.id} className={`border-b ${K.line2} py-3 last:border-b-0`}>
                      <button type="button" onClick={() => setPeek(peek === i ? null : i === current ? null : i)} className="flex w-full items-start gap-4 text-left">
                        <span className={`mt-px w-6 shrink-0 font-serif lining text-[18px] ${isDone ? K.accent : i === current ? K.fg : K.fg3}`}>{isDone ? "✓" : String(i + 1).padStart(2, "0")}</span>
                        <span className={`min-w-0 flex-1 text-sm ${isDone ? `${K.fg3} line-through decoration-(--line)` : i === current ? "font-semibold text-(--fg)" : K.fg2}`}>{st.title}</span>
                      </button>
                      {isOpen && (
                        <div className="pl-10">
                          <p className={`mt-1.5 text-[13px] leading-relaxed ${K.fg2}`}>{st.body}</p>
                          <TextLink
                            className="mt-2.5"
                            onClick={() => {
                              st.go(state).forEach((a) => dispatch(a));
                              setPeek(null);
                              onClose?.();
                            }}
                          >
                            Take me there
                          </TextLink>
                        </div>
                      )}
                    </li>
                  );
                })}
            </ol>
          </section>
        ))}
      </div>

      <div className={`border-t ${K.line} px-8 py-5`}>
        {count === total ? (
          <a href="/orbs/#pricing" className="block">
            <Pill tone="accent" right="→" className="pointer-events-none">
              That was the whole system. Get it
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
