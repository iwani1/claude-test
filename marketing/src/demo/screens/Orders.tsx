"use client";

import { useState } from "react";
import { ROLES } from "../data";
import { ghs } from "../pricing";
import { can, currentUser, price, staffById, tableOf, useDemo, type Order } from "../store";
import { Caps, Field, inputCls, K, Modal, Money, Num, PageHead, Pill, Rows, Tab, TextLink, timeOf } from "../ui";
import { Receipt, TYPE_LABEL } from "./Till";

type Filter = "all" | "open" | "paid" | "refunded" | "comp";

export function Orders() {
  const { state } = useDemo();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [view, setView] = useState<string | null>(null);
  const [refunding, setRefunding] = useState<string | null>(null);

  const list = [...state.orders]
    .sort((a, b) => (b.paidAt ?? b.openedAt) - (a.paidAt ?? a.openedAt))
    .filter((o) => (filter === "open" ? !o.paidAt : filter === "paid" ? Boolean(o.paidAt) && !o.refund : filter === "refunded" ? Boolean(o.refund) : filter === "comp" ? Boolean(o.complimentary) : true))
    .filter((o) => !q || String(o.number).includes(q) || tableOf(state, o.tableId).name.toLowerCase().includes(q.toLowerCase()) || (o.customer ?? "").toLowerCase().includes(q.toLowerCase()) || o.lines.some((l) => l.name.toLowerCase().includes(q.toLowerCase())));
  const paid = state.orders.filter((o) => o.payment);
  const refunded = paid.filter((o) => o.refund).reduce((n, o) => n + o.refund!.amountCents, 0);
  const viewing = state.orders.find((o) => o.id === view) ?? null;

  return (
    <div className="px-6 pb-20 pt-8 lg:px-14">
      <PageHead kicker="Transaction trail" title="Orders." lede={`${state.orders.length} orders this shift · ${paid.length} paid · ${ghs(refunded)} refunded · every receipt can be reprinted, every refund needs a manager.`}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search # table guest dish…" className={`${inputCls} w-64 text-sm`} />
      </PageHead>

      <div className="mt-10 flex gap-7">
        {(["all", "open", "paid", "refunded", "comp"] as Filter[]).map((f) => (
          <Tab key={f} name="orders" on={filter === f} onClick={() => setFilter(f)}>
            {f === "comp" ? "Complimentary" : f}
          </Tab>
        ))}
      </div>

      <div className="mt-6">
        <Rows head={["Time", "Order", "Table · guest", "Items", "Tender", "Status", "Total"]}>
          {list.map((o) => {
            const p = price(state, o);
            const status = o.refund ? "refunded" : o.complimentary && o.paidAt ? "complimentary" : o.paidAt ? "paid" : o.lines.some((l) => !l.sent) ? "open · unsent" : "open";
            return (
              <tr key={o.id} className="group">
                <td className={`py-3 pr-4 ${K.fg3}`}>
                  <Num>{timeOf(o.paidAt ?? o.openedAt)}</Num>
                </td>
                <td className="py-3 pr-4">
                  <button type="button" onClick={() => setView(o.id)} className="font-serif text-[17px] lining hover:text-(--accent)">
                    #{o.number}
                  </button>
                </td>
                <td className={`py-3 pr-4 ${K.fg2}`}>
                  {tableOf(state, o.tableId).name}
                  {o.customer ? <span className={K.fg3}> · {o.customer}</span> : null}
                  <span className={`block text-xs ${K.fg3}`}>{TYPE_LABEL[o.type]}</span>
                </td>
                <td className={`max-w-[260px] truncate py-3 pr-4 text-xs ${K.fg3}`}>{o.lines.map((l) => `${l.qty}× ${l.name}`).join(", ")}</td>
                <td className={`py-3 pr-4 text-xs ${K.fg2}`}>{o.payment ? (o.payment.method === "cash" ? "Cash" : o.payment.method === "momo" ? `MoMo ${o.payment.network}` : "Split") : "—"}</td>
                <td className={`py-3 pr-4 text-[11px] font-semibold uppercase tracking-[.16em] ${status === "refunded" ? K.bad : status.startsWith("open") ? K.warn : status === "complimentary" ? K.fg2 : K.fg3}`}>{status}</td>
                <td className="py-3 text-right">
                  <Num className="text-[16px]">{ghs(p.totalCents)}</Num>
                  {o.refund && <span className={`block text-xs ${K.bad}`}>−{ghs(o.refund.amountCents)}</span>}
                </td>
              </tr>
            );
          })}
        </Rows>
        {!list.length && <p className={`py-10 font-serif text-[22px] italic ${K.fg3}`}>Nothing matches.</p>}
      </div>

      <OrderModal order={viewing} onClose={() => setView(null)} onRefund={(id) => setRefunding(id)} />
      <RefundModal orderId={refunding} onClose={() => setRefunding(null)} />
    </div>
  );
}

function OrderModal({ order, onClose, onRefund }: { order: Order | null; onClose: () => void; onRefund: (id: string) => void }) {
  const { state, dispatch } = useDemo();
  const user = currentUser(state);
  return (
    <Modal open={Boolean(order)} onClose={onClose} kicker={order ? `${tableOf(state, order.tableId).name} · ${TYPE_LABEL[order.type]} · opened ${timeOf(order.openedAt)} by ${staffById(state, order.byId)?.name.split(" ")[0] ?? "—"}` : undefined} title={order ? `Order #${order.number}` : ""} width="max-w-[440px]">
      {order?.payment ? (
        <>
          <Receipt order={order} />
          <div className="mt-6 flex items-center justify-between">
            <TextLink tone="fg2" arrow={false} onClick={() => dispatch({ type: "toast", text: `Receipt #${order.number} sent to the ${state.hardware.printerMode === "network" ? `printer at ${state.hardware.printerIp}` : "browser print dialog"}`, tone: "info" })}>
              Reprint
            </TextLink>
            {!order.refund && (user?.role === "cashier" || can(state, "refund")) && (
              <TextLink
                onClick={() => {
                  onClose();
                  onRefund(order.id);
                }}
              >
                Refund{can(state, "refund") ? "" : " (manager approves)"}
              </TextLink>
            )}
          </div>
        </>
      ) : order ? (
        <>
          <ul className={`border-t ${K.line}`}>
            {order.lines.map((l) => (
              <li key={l.id} className={`flex justify-between gap-4 border-b py-2 text-sm ${K.line2}`}>
                <span>
                  {l.name}
                  {l.qty > 1 ? <span className={K.fg3}> × {l.qty}</span> : null}
                  {!l.sent && <span className={`ml-2 text-[11px] font-semibold uppercase tracking-[.14em] ${K.warn}`}>unsent</span>}
                </span>
                <Num className={K.fg2}>{((l.unitCents * l.qty) / 100).toFixed(2)}</Num>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex items-end justify-between">
            <Caps>Still open</Caps>
            <Money cents={price(state, order).totalCents} size="lg" />
          </div>
          {can(state, "pos") && (
            <Pill
              tone="accent"
              className="mt-7"
              onClick={() => {
                onClose();
                dispatch({ type: "selectTable", tableId: order.tableId });
              }}
            >
              Open on the till
            </Pill>
          )}
        </>
      ) : null}
    </Modal>
  );
}

function RefundModal({ orderId, onClose }: { orderId: string | null; onClose: () => void }) {
  const { state, dispatch } = useDemo();
  const order = state.orders.find((o) => o.id === orderId);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [pin, setPin] = useState("");
  const me = currentUser(state);
  const manager = can(state, "refund");
  const authBy = manager ? me : state.staff.find((u) => u.pin && u.pin === pin && ROLES[u.role].can.includes("refund"));
  const cents = Math.round(Number(amount) * 100);
  const max = order?.payment?.amountCents ?? 0;
  const ok = Boolean(order && authBy && reason.trim().length >= 3 && Number.isFinite(cents) && cents > 0 && cents <= max);
  const cashBack = order?.payment ? Math.min(cents || 0, order.payment.cashCents) : 0;
  return (
    <Modal open={Boolean(order)} onClose={onClose} kicker={order ? `#${order.number} · paid ${ghs(max)} ${order.payment?.method === "cash" ? "in cash" : order.payment?.method === "momo" ? "by MoMo" : "cash + MoMo"}` : undefined} title="Refund">
      {order && (
        <div className="space-y-7">
          <div className="flex flex-wrap gap-2">
            {order.lines.map((l) => (
              <button key={l.id} type="button" onClick={() => setAmount((price(state, { ...order, lines: [l], discount: null, tipCents: 0 }).totalCents / 100).toFixed(2))} className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${K.line} ${K.fg2} hover:text-(--fg)`}>
                {l.qty}× {l.name}
              </button>
            ))}
            <button type="button" onClick={() => setAmount((max / 100).toFixed(2))} className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${K.line} ${K.fg2} hover:text-(--fg)`}>
              Whole bill
            </button>
          </div>
          <Field label="Amount (GH₵)" hint={cents > max ? `Can’t exceed what was paid (${ghs(max)})` : cashBack > 0 ? `${ghs(cashBack)} comes out of the drawer${cents > cashBack ? `, ${ghs(cents - cashBack)} is reversed on MoMo` : ""}` : cents > 0 ? "Reversed on MoMo — nothing leaves the drawer" : undefined}>
            <input autoFocus inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className={`${inputCls} font-serif text-[40px] lining`} />
          </Field>
          <Field label="Reason" hint="Printed on the refund slip and kept in the audit trail.">
            <input value={reason} onChange={(e) => setReason(e.target.value.slice(0, 60))} placeholder="Served cold · wrong dish · guest left" className={inputCls} />
          </Field>
          {!manager && (
            <Field label="Manager PIN" hint="A cashier can start a refund but a manager must approve it — Efua’s PIN is 2222.">
              <input inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="••••" className={`${inputCls} font-serif text-[28px] lining`} />
            </Field>
          )}
          <Pill
            tone="accent"
            disabled={!ok}
            right={authBy ? `approved by ${authBy.name.split(" ")[0]}` : undefined}
            onClick={() => {
              dispatch({ type: "refund", orderId: order.id, amountCents: cents, reason: reason.trim(), authorizedById: authBy!.id });
              setAmount("");
              setReason("");
              setPin("");
              onClose();
            }}
          >
            Refund {cents > 0 && cents <= max ? ghs(cents) : ""}
          </Pill>
        </div>
      )}
    </Modal>
  );
}
