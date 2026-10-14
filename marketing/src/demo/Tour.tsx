"use client";

import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { useEffect } from "react";
import { can, type Module } from "./data";
import { currentUser, useStore } from "./store";

interface Step { module: Module; title: string; text: string }

const STEPS: Step[] = [
  { module: "today", title: "The shift at a glance", text: "Sales so far, open tables, what the kitchen is holding and anything that needs a decision. Every tile is a shortcut." },
  { module: "till", title: "The Till", text: "Categories on the left, dishes in the middle, the bill on the right. Tap a dish to add it, hover a line to change quantity, add a note for the kitchen." },
  { module: "till", title: "Send, then charge", text: "New items show in red until you send them to the pass. Charge opens the pay sheet: Cash with a keypad and change due, MoMo by network, or a split." },
  { module: "floor", title: "The floor", text: "Tables, the bar, rooms and takeaway. Yellow is open, dashed blue is reserved, stripes need clearing. Tap a free table to seat guests." },
  { module: "kitchen", title: "The pass", text: "Every sent ticket, oldest first, with a live timer. Yellow after 8 minutes, red after 15. Start → Ready → Served walks it off the screen." },
  { module: "orders", title: "Every order", text: "Open, paid, refunded or void. Pick one for its lines, payments and timeline; refund in full or by item — a cashier needs a manager's PIN." },
  { module: "drawer", title: "The drawer", text: "Opening float plus cash sales, minus payouts and cash refunds, equals what should be in the drawer. Count by denomination to close the day." },
  { module: "menu", title: "Menu", text: "Prices, prep times and availability. Flip a dish to 86'd and it greys out on the Till within the second." },
  { module: "recipes", title: "Recipes & costing", text: "Each dish lists what goes on the plate, so you see the plated cost and the margin — and stock moves automatically when it sells." },
  { module: "ingredients", title: "Ingredients", text: "On hand against par levels, what tonight's sales have used, and quick adjustments for waste or a recount." },
  { module: "purchasing", title: "Purchasing", text: "Draft an order from what's low, send it, receive it as a GRN (stock goes up) and record the supplier invoice." },
  { module: "reports", title: "Reports", text: "Gross and net sales, VAT, tender breakdown, value forgone, top dishes and staff — all exportable as CSV for the accountant." },
  { module: "audit", title: "Audit trail", text: "Everything with a money or stock consequence lands here with who, when and the details. Discounts, voids, refunds, price changes." },
  { module: "staff", title: "People & permissions", text: "Roles decide which modules a PIN opens. Switch user from the avatar menu to see the system shrink to what each person needs." },
];

export function Tour() {
  const { state, api } = useStore();
  const me = currentUser(state)!;
  const steps = STEPS.filter((s) => can(me.role, s.module));
  const i = Math.min(state.tour ?? 0, steps.length - 1);
  const step = steps[i];

  useEffect(() => {
    if (step && state.module !== step.module) api.go(step.module);
    // Only when the step changes — the user may wander within a step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  if (!step) return null;
  const close = () => api.setTour(null);
  return (
    <aside className="tour" role="dialog" aria-label="Guided tour">
      <div className="flex items-start justify-between gap-3">
        <div className="tour-step">Tour · {i + 1} of {steps.length}</div>
        <button type="button" onClick={close} aria-label="Close tour" className="-mr-1 -mt-1 rounded-lg p-1 hover:bg-white/10"><X size={16} /></button>
      </div>
      <h3 className="tour-title">{step.title}</h3>
      <p>{step.text}</p>
      <div className="mt-4 flex items-center justify-between">
        <div className="tour-dots">{steps.map((_, k) => <i key={k} className={k <= i ? "on" : ""} />)}</div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-sm" style={{ color: "var(--cream)", border: "2px solid rgba(255,246,230,.25)" }} disabled={i === 0} onClick={() => api.setTour(i - 1)}><ArrowLeft size={14} strokeWidth={3} /></button>
          {i < steps.length - 1 ? (
            <button type="button" className="btn btn-sm btn-sun" onClick={() => api.setTour(i + 1)}>Next <ArrowRight size={14} strokeWidth={3} /></button>
          ) : (
            <button type="button" className="btn btn-sm btn-sun" onClick={close}>Done</button>
          )}
        </div>
      </div>
    </aside>
  );
}
