"use client";

import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, Flame, Timer } from "lucide-react";
import { MENU_BY_ID, TABLE_BY_ID } from "../data";
import { useDemo, type KitchenStatus, type Ticket } from "../store";
import { Btn, Chip, Panel, T, minsSince, timeOf } from "../ui";

const COLUMNS: { status: KitchenStatus; title: string; hint: string }[] = [
  { status: "pending", title: "New", hint: "Fired from the till" },
  { status: "preparing", title: "Cooking", hint: "On the stove" },
  { status: "ready", title: "Ready", hint: "On the pass" },
];

export function Kitchen() {
  const { state, now } = useDemo();
  const live = state.tickets.filter((t) => t.status !== "completed");
  const done = state.tickets.filter((t) => t.status === "completed");
  const avg = done.filter((t) => t.readyAt).reduce((n, t, _, a) => n + (t.readyAt! - t.firedAt) / a.length, 0);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-1 text-sm">
        <p className="font-serif text-xl italic text-emerald-100">Kitchen display · main pass</p>
        <span className={T.muted}>
          {live.length} live · {done.length} served this shift · avg {avg ? `${Math.round(avg / 60000)} min` : "—"} ticket-to-pass
        </span>
        <span className={`ml-auto hidden items-center gap-3 text-xs sm:flex ${T.muted}`}>
          <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-emerald-400" /> under 8 min</span>
          <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-amber-400" /> 8–15 min</span>
          <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-rose-400" /> over 15 min</span>
        </span>
      </div>

      <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto pb-4 md:grid-cols-3 md:grid-rows-[minmax(0,1fr)] md:overflow-visible md:pb-0">
        {COLUMNS.map((col) => {
          const tickets = live.filter((t) => t.status === col.status).sort((a, b) => a.firedAt - b.firedAt);
          return (
            <Panel key={col.status} className="flex min-h-[160px] flex-col md:min-h-0">
              <div className={`flex items-center justify-between border-b ${T.line} px-4 py-3`}>
                <div>
                  <p className="font-bold">{col.title}</p>
                  <p className={`text-xs ${T.muted}`}>{col.hint}</p>
                </div>
                <span className={`grid h-8 min-w-8 place-items-center rounded-full px-2 text-sm font-black ${col.status === "ready" ? "bg-emerald-400 text-emerald-950" : col.status === "preparing" ? "bg-amber-400 text-amber-950" : "bg-white/10"}`}>{tickets.length}</span>
              </div>
              <div className="flex-1 space-y-2.5 overflow-y-auto p-2.5 md:min-h-0">
                <AnimatePresence initial={false}>
                  {tickets.map((t) => (
                    <TicketCard key={t.id} ticket={t} now={now} />
                  ))}
                </AnimatePresence>
                {!tickets.length && (
                  <div className={`grid h-24 place-items-center rounded-xl border border-dashed ${T.line} text-xs ${T.muted}`}>
                    {col.status === "pending" ? "Nothing waiting — send an order from the till" : col.status === "preparing" ? "Nothing cooking" : "Pass is clear"}
                  </div>
                )}
              </div>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}

function TicketCard({ ticket, now }: { ticket: Ticket; now: number }) {
  const { dispatch } = useDemo();
  const mins = minsSince(ticket.firedAt, now);
  const urgency = ticket.status === "ready" ? "ok" : mins > 15 ? "late" : mins > 8 ? "warn" : "ok";
  const ring = urgency === "late" ? "border-rose-400/50 shadow-[0_0_0_3px_rgba(251,113,133,.12)]" : urgency === "warn" ? "border-amber-400/40" : T.line;
  const table = TABLE_BY_ID[ticket.tableId];
  return (
    <motion.article
      layout
      initial={{ opacity: 0, scale: 0.96, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, x: 24 }}
      transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
      className={`overflow-hidden rounded-xl border bg-black/25 ${ring}`}
    >
      <div className={`flex items-center justify-between border-b ${T.line} px-3 py-2`}>
        <div className="flex items-center gap-2">
          <span className="text-base font-black">{table.label}</span>
          <span className={`text-xs ${T.muted}`}>#{ticket.number}</span>
          {table.type !== "dine_in" && <Chip tone="amber" className="!py-0.5">{table.type === "room_service" ? "Room" : "Takeaway"}</Chip>}
        </div>
        <span className={`flex items-center gap-1 text-xs font-bold tabular ${urgency === "late" ? "text-rose-300" : urgency === "warn" ? "text-amber-300" : "text-emerald-300"}`}>
          <Timer size={13} /> {mins}m
        </span>
      </div>
      <ul className="space-y-1 px-3 py-2 text-sm">
        {ticket.lines.map((l, i) => (
          <li key={i}>
            <span className="flex gap-2">
              <span className="w-5 shrink-0 text-right font-black text-amber-200">{l.qty}</span>
              <span className="font-medium">{MENU_BY_ID[l.itemId].name}</span>
            </span>
            {l.note && <span className="ml-7 block text-xs italic text-amber-200/90">“{l.note}”</span>}
          </li>
        ))}
      </ul>
      <div className={`flex items-center gap-2 border-t ${T.line} p-2 text-xs`}>
        <span className={`mr-auto ${T.muted}`}>fired {timeOf(ticket.firedAt)}</span>
        {ticket.status === "pending" && (
          <Btn tone="amber" size="sm" onClick={() => dispatch({ type: "kitchen", ticketId: ticket.id, status: "preparing" })}>
            <Flame size={13} /> Start prep
          </Btn>
        )}
        {ticket.status === "preparing" && (
          <Btn tone="mint" size="sm" onClick={() => dispatch({ type: "kitchen", ticketId: ticket.id, status: "ready" })}>
            <CheckCircle2 size={13} /> Mark ready
          </Btn>
        )}
        {ticket.status === "ready" && (
          <Btn size="sm" onClick={() => dispatch({ type: "kitchen", ticketId: ticket.id, status: "completed" })}>
            Dispatch / clear
          </Btn>
        )}
      </div>
    </motion.article>
  );
}
