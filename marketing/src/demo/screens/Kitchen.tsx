"use client";

import { AnimatePresence, motion } from "motion/react";
import { MENU_BY_ID, TABLE_BY_ID } from "../data";
import { useDemo, type KitchenStatus, type Ticket } from "../store";
import { Caps, K, minsSince, Num, TextLink, timeOf } from "../ui";

const COLUMNS: { status: KitchenStatus; title: string; hint: string; empty: string }[] = [
  { status: "pending", title: "New", hint: "fired from the till", empty: "Nothing waiting — send an order from the till." },
  { status: "preparing", title: "Cooking", hint: "on the stove", empty: "Nothing cooking." },
  { status: "ready", title: "Ready", hint: "on the pass", empty: "The pass is clear." },
];

export function Kitchen() {
  const { state, now } = useDemo();
  const live = state.tickets.filter((t) => t.status !== "completed");
  const done = state.tickets.filter((t) => t.status === "completed");
  const timed = done.filter((t) => t.readyAt);
  const avg = timed.length ? timed.reduce((n, t) => n + (t.readyAt! - t.firedAt), 0) / timed.length : 0;

  return (
    <div className="px-6 pb-16 pt-8 lg:px-14">
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-3">
        <div>
          <Caps>Main pass</Caps>
          <h1 className="mt-1 font-serif text-[40px] italic leading-none tracking-[-.02em]">Kitchen</h1>
        </div>
        <p className={`text-sm ${K.fg2}`}>
          <Num className="text-[20px] text-(--fg)">{live.length}</Num> live · <Num className="text-[20px] text-(--fg)">{done.length}</Num> served this shift · ticket‑to‑pass{" "}
          <Num className="text-[20px] text-(--fg)">{avg ? Math.round(avg / 60000) : "—"}</Num> min
          <span className={`ml-6 hidden text-xs lg:inline ${K.fg3}`}>amber after 8 min · red after 15</span>
        </p>
      </div>

      <div className={`mt-10 grid gap-10 border-t ${K.line} pt-8 md:grid-cols-3 md:gap-0 md:divide-x md:divide-(--line)`}>
        {COLUMNS.map((col, i) => {
          const tickets = live.filter((t) => t.status === col.status).sort((a, b) => a.firedAt - b.firedAt);
          return (
            <section key={col.status} className={`min-h-[320px] ${i === 0 ? "md:pr-10" : i === 1 ? "md:px-10" : "md:pl-10"}`}>
              <header className="flex items-baseline justify-between">
                <h2>
                  <Caps tone={col.status === "ready" && tickets.length ? "accent" : "fg3"}>{col.title}</Caps>
                  <span className={`ml-2 text-xs ${K.fg3}`}>{col.hint}</span>
                </h2>
                <Num className={`text-[28px] font-light ${tickets.length ? K.fg : K.fg3}`}>{tickets.length}</Num>
              </header>
              <AnimatePresence initial={false} mode="popLayout">
                {tickets.map((t) => (
                  <TicketRow key={t.id} ticket={t} now={now} />
                ))}
              </AnimatePresence>
              {!tickets.length && <p className={`mt-8 font-serif text-[20px] italic ${K.fg3}`}>{col.empty}</p>}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function TicketRow({ ticket, now }: { ticket: Ticket; now: number }) {
  const { dispatch } = useDemo();
  const mins = minsSince(ticket.firedAt, now);
  const urgency = ticket.status === "ready" ? "ok" : mins > 15 ? "late" : mins > 8 ? "warn" : "ok";
  const table = TABLE_BY_ID[ticket.tableId];
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
      className={`border-b ${K.line2} py-6 first-of-type:mt-4`}
    >
      <div className="flex items-baseline justify-between">
        <p className="flex items-baseline gap-3">
          <Num className="text-[30px] font-light leading-none tracking-[-.01em]">{table.code}</Num>
          <span className={`text-xs ${K.fg3}`}>
            #{ticket.number}
            {table.type !== "dine_in" && ` · ${table.type === "room_service" ? "room service" : "takeaway"}`}
          </span>
        </p>
        <p className={`text-sm ${urgency === "late" ? K.bad : urgency === "warn" ? K.warn : K.fg2}`} title={`fired ${timeOf(ticket.firedAt)}`}>
          <Num className="text-[22px]">{mins}</Num> min
        </p>
      </div>
      <ul className="mt-3 space-y-1.5">
        {ticket.lines.map((l, i) => (
          <li key={i} className="text-[15px]">
            <span className="flex gap-3">
              <Num className={`w-5 shrink-0 text-right text-[17px] ${K.accent}`}>{l.qty}</Num>
              <span>{MENU_BY_ID[l.itemId].name}</span>
            </span>
            {l.note && <span className={`ml-8 block font-serif text-[14px] italic ${K.fg2}`}>“{l.note}”</span>}
          </li>
        ))}
      </ul>
      <div className="mt-4 flex items-center justify-between">
        <span className={`text-xs ${K.fg3}`}>{ticket.status === "pending" ? `fired ${timeOf(ticket.firedAt)}` : ticket.status === "preparing" ? `started ${timeOf(ticket.startedAt ?? ticket.firedAt)}` : `ready ${timeOf(ticket.readyAt ?? now)}`}</span>
        {ticket.status === "pending" && <TextLink onClick={() => dispatch({ type: "kitchen", ticketId: ticket.id, status: "preparing" })}>Start prep</TextLink>}
        {ticket.status === "preparing" && <TextLink onClick={() => dispatch({ type: "kitchen", ticketId: ticket.id, status: "ready" })}>Mark ready</TextLink>}
        {ticket.status === "ready" && (
          <TextLink tone="fg2" onClick={() => dispatch({ type: "kitchen", ticketId: ticket.id, status: "completed" })}>
            Clear
          </TextLink>
        )}
      </div>
    </motion.article>
  );
}
