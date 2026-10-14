"use client";

import { Banknote, Coins, Lock, Printer } from "lucide-react";
import { useState } from "react";
import type { DrawerKind } from "../data";
import { cedi, hm, num, parseCedi } from "../money";
import { drawerExpected, openDrawer, totals, useStore } from "../store";
import { Badge, Card, Field, Modal, Money, Stat, cx } from "../ui";

const KIND: Record<DrawerKind, { label: string; tone: "sun" | "forest" | "terra" | "cobalt" | "ink" }> = {
  float: { label: "Float", tone: "cobalt" }, sale: { label: "Cash sale", tone: "forest" }, payout: { label: "Payout", tone: "terra" }, payin: { label: "Pay in", tone: "sun" }, refund: { label: "Cash refund", tone: "terra" },
};

const DENOMS = [20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50, 20, 10];

export function Drawer() {
  const { state, api } = useStore();
  const d = openDrawer(state);
  const [sheet, setSheet] = useState<"payout" | "payin" | "count" | "open" | null>(null);
  const vat = state.settings.vat;
  const sum = (k: DrawerKind) => (d ? d.events.filter((e) => e.kind === k).reduce((s, e) => s + e.amount, 0) : 0);
  const momo = state.orders.flatMap((o) => o.payments).filter((p) => p.method !== "cash" && (!d || p.at >= d.openedAt)).reduce((s, p) => s + p.amount, 0);
  const expected = d ? drawerExpected(d) : 0;
  const closedSessions = [...state.drawer].filter((s) => s.closedAt).reverse();

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="kicker" style={{ color: "var(--sun-d)" }}>Service · Drawer</div>
          <h1 className="page-title mt-2">{d ? "Cash drawer" : "Drawer is closed"}</h1>
          <p className="page-sub">{d ? `Opened ${hm(d.openedAt)} by ${d.openedBy} · float ${cedi(d.float)}` : "Open a drawer with a float before taking cash."}</p>
        </div>
        <div className="flex gap-2">
          {d ? (
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setSheet("payin")}>Pay in</button>
              <button type="button" className="btn btn-ghost" onClick={() => setSheet("payout")}>Pay out</button>
              <button type="button" className="btn btn-sun" onClick={() => setSheet("count")}><Lock size={16} strokeWidth={2.5} /> Count & close</button>
            </>
          ) : (
            <button type="button" className="btn btn-sun" onClick={() => setSheet("open")}><Banknote size={16} strokeWidth={2.5} /> Open drawer</button>
          )}
        </div>
      </div>

      {d && (
        <>
          <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr_1fr_1fr_1fr]">
            <div className="block ink-block stat">
              <span className="stat-label">Expected in drawer</span>
              <span><span className="stat-value block" style={{ color: "var(--sun)", fontSize: 40 }}><Money v={expected} /></span><span className="stat-sub mt-2 block">float + cash sales − payouts − cash refunds</span></span>
            </div>
            <Stat tone="forest" label="Cash sales" value={<Money v={sum("sale")} />} sub={`${d.events.filter((e) => e.kind === "sale").length} cash payments`} />
            <Stat tone="terra" label="Payouts" value={<Money v={-sum("payout")} />} sub={`${d.events.filter((e) => e.kind === "payout").length} payouts`} />
            <Stat tone="sun" label="Cash refunds" value={<Money v={-sum("refund")} />} sub={sum("payin") ? `+ ${cedi(sum("payin"))} paid in` : "no pay-ins"} />
            <Stat tone="cobalt" label="MoMo & QR" value={<Money v={momo} />} sub="not in the drawer" />
          </div>

          <Card title="Drawer events" className="mt-4" pad={false} actions={<span className="text-[12px] font-bold text-[var(--ink3)]">{d.events.length} entries</span>}>
            <div className="tbl-wrap max-h-[52vh]">
              <table className="tbl">
                <thead><tr><th>Time</th><th>Type</th><th>Detail</th><th>By</th><th className="r">Amount</th><th className="r">Running</th></tr></thead>
                <tbody>
                  {[...d.events].reverse().map((e, i, arr) => {
                    const running = arr.slice(i).reduce((s, x) => s + x.amount, 0);
                    return (
                      <tr key={e.id}>
                        <td>{hm(e.at)}</td>
                        <td><Badge tone={KIND[e.kind].tone}>{KIND[e.kind].label}</Badge></td>
                        <td className="text-[var(--ink2)]">{e.note}</td>
                        <td>{e.by.split(" ")[0]}</td>
                        <td className={cx("r d strong", e.amount < 0 && "c-terra")}>{e.amount < 0 ? "−" : "+"}{num(Math.abs(e.amount))}</td>
                        <td className="r num text-[var(--ink3)]">{num(running)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {closedSessions.length > 0 && (
        <Card title="Closed sessions" className="mt-4" pad={false}>
          <table className="tbl">
            <thead><tr><th>Opened</th><th>Closed</th><th>By</th><th className="r">Float</th><th className="r">Expected</th><th className="r">Counted</th><th className="r">Variance</th></tr></thead>
            <tbody>
              {closedSessions.map((s) => (
                <tr key={s.id}>
                  <td>{hm(s.openedAt)}</td><td>{hm(s.closedAt!)}</td><td>{s.closedBy.split(" ")[0]}</td>
                  <td className="r num">{num(s.float)}</td><td className="r num">{num(drawerExpected(s))}</td><td className="r d strong">{num(s.counted ?? 0)}</td>
                  <td className={cx("r d strong", (s.variance ?? 0) < 0 ? "c-terra" : (s.variance ?? 0) > 0 ? "c-cobalt" : "c-forest")}>{(s.variance ?? 0) === 0 ? "balanced" : `${(s.variance ?? 0) > 0 ? "+" : "−"}${num(Math.abs(s.variance ?? 0))}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {!d && (
        <div className="mt-6 grid gap-4 xl:grid-cols-3">
          <Stat tone="sun" label="Today's cash sales" value={<Money v={state.orders.flatMap((o) => o.payments).filter((p) => p.method === "cash").reduce((s, p) => s + p.amount, 0)} />} sub="all sessions" />
          <Stat tone="cobalt" label="MoMo & QR" value={<Money v={state.orders.flatMap((o) => o.payments).filter((p) => p.method !== "cash").reduce((s, p) => s + p.amount, 0)} />} sub="settles to the bank" />
          <Stat tone="forest" label="Orders" value={state.orders.filter((o) => o.status === "paid" || o.status === "refunded").length} sub={cedi(state.orders.filter((o) => o.status !== "open" && o.status !== "void").reduce((s, o) => s + totals(o, vat).total, 0))} />
        </div>
      )}

      {(sheet === "payout" || sheet === "payin") && <MoveSheet kind={sheet} onClose={() => setSheet(null)} />}
      {sheet === "count" && <CountSheet expected={expected} onClose={() => setSheet(null)} />}
      {sheet === "open" && <OpenSheet onClose={() => setSheet(null)} />}
    </div>
  );
}

function MoveSheet({ kind, onClose }: { kind: "payout" | "payin"; onClose: () => void }) {
  const { api } = useStore();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState(kind === "payout" ? "Supplier top-up (cash)" : "Change from the bank");
  const v = parseCedi(amount);
  return (
    <Modal title={kind === "payout" ? "Pay out of the drawer" : "Pay into the drawer"} sub="Logged with your name on the drawer and in the audit trail" onClose={onClose}
      foot={<button type="button" className={cx("btn grow", kind === "payout" ? "btn-terra" : "btn-forest")} disabled={!v || !note.trim()} onClick={() => { api.cashMove(kind, v, note.trim()); onClose(); }}>{kind === "payout" ? "Pay out" : "Pay in"} {v ? cedi(v) : ""}</button>}>
      <Field label="Amount (GH₵)"><input className="input lg" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" autoFocus /></Field>
      <Field label="Reason">
        <select className="select" value={note} onChange={(e) => setNote(e.target.value)}>
          {(kind === "payout" ? ["Supplier top-up (cash)", "Gas cylinder refill", "Fuel for delivery bike", "Staff transport", "Petty cash — cleaning", "Other"] : ["Change from the bank", "Returned petty cash", "Owner top-up", "Other"]).map((r) => <option key={r}>{r}</option>)}
        </select>
      </Field>
    </Modal>
  );
}

function CountSheet({ expected, onClose }: { expected: number; onClose: () => void }) {
  const { api } = useStore();
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [done, setDone] = useState<{ counted: number; variance: number; expected: number } | null>(null);
  const counted = DENOMS.reduce((s, dnm) => s + dnm * (counts[dnm] ?? 0), 0);
  const variance = counted - expected;

  if (done) {
    return (
      <Modal title="Drawer closed" sub="Z-summary printed to the receipt printer" onClose={onClose} tone="forest" foot={<><button type="button" className="btn btn-ghost" onClick={() => api.print("Z report")}><Printer size={16} /> Print again</button><button type="button" className="btn btn-sun grow" onClick={onClose}>Done</button></>}>
        <div className="grid grid-cols-3 gap-3">
          <div className="block stat !min-h-[96px]" data-tone="ink"><span className="stat-label">Expected</span><span className="stat-value !text-[24px]"><Money v={done.expected} /></span></div>
          <div className="block stat !min-h-[96px]" data-tone="sun"><span className="stat-label">Counted</span><span className="stat-value !text-[24px]"><Money v={done.counted} /></span></div>
          <div className="block stat !min-h-[96px]" data-tone={done.variance === 0 ? "forest" : done.variance < 0 ? "terra" : "cobalt"}><span className="stat-label">Variance</span><span className="stat-value !text-[24px]">{done.variance === 0 ? "0.00" : `${done.variance > 0 ? "+" : "−"}${num(Math.abs(done.variance))}`}</span></div>
        </div>
        <p className="text-[12.5px] font-medium text-[var(--ink3)]">{done.variance === 0 ? "Balanced to the pesewa." : done.variance < 0 ? "Short — the variance is logged against the closing user for the manager to review." : "Over — usually change given wrongly; logged for review."}</p>
      </Modal>
    );
  }

  return (
    <Modal title="Count the drawer" sub={<>Expected <b>{cedi(expected)}</b>. Count notes and coins, then close.</>} onClose={onClose} size="w"
      foot={<><button type="button" className="btn btn-ghost" onClick={onClose}>Not yet</button><button type="button" className="btn btn-ink grow" disabled={!counted} onClick={() => { api.closeDrawer(counted); setDone({ counted, variance, expected }); }}><Lock size={16} /> Close drawer with {cedi(counted)}</button></>}>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 md:grid-cols-3">
        {DENOMS.map((dnm) => (
          <label key={dnm} className="flex items-center justify-between gap-2 rounded-xl border-2 border-[var(--line)] bg-white px-3 py-2">
            <span className="d flex items-center gap-2 text-[14px] font-bold">{dnm >= 100 ? <Banknote size={15} className="c-forest" /> : <Coins size={15} className="c-sun" />}{dnm >= 100 ? `GH₵ ${dnm / 100}` : `${dnm}p`}</span>
            <input className="input !h-9 !w-16 !px-2 text-center" inputMode="numeric" value={counts[dnm] ?? ""} placeholder="0" onChange={(e) => setCounts((c) => ({ ...c, [dnm]: Math.max(0, Number.parseInt(e.target.value, 10) || 0) }))} />
          </label>
        ))}
      </div>
      <div className={cx("amount-box", variance < 0 && "is-short")}>
        <span className="lbl">Counted</span><span className="val">{cedi(counted)}</span>
        <span className="chg">Variance<b style={variance === 0 ? { color: "var(--forest)" } : variance > 0 ? { color: "var(--cobalt)" } : undefined}>{variance === 0 ? "0.00" : `${variance > 0 ? "+" : "−"}${num(Math.abs(variance))}`}</b></span>
      </div>
    </Modal>
  );
}

function OpenSheet({ onClose }: { onClose: () => void }) {
  const { api } = useStore();
  const [float, setFloat] = useState("1200.00");
  const v = parseCedi(float);
  return (
    <Modal title="Open the drawer" sub="Count the float you're starting with" onClose={onClose} foot={<button type="button" className="btn btn-sun grow" disabled={!v} onClick={() => { api.openDrawer(v); onClose(); }}>Open with {cedi(v)}</button>}>
      <Field label="Opening float (GH₵)"><input className="input lg" value={float} onChange={(e) => setFloat(e.target.value)} inputMode="decimal" autoFocus /></Field>
      <div className="grid grid-cols-4 gap-2">{["500.00", "1000.00", "1200.00", "2000.00"].map((f) => <button key={f} type="button" className={cx("quick", float === f && "border-[var(--ink)] bg-[var(--sun-l)]")} onClick={() => setFloat(f)}>{f.replace(".00", "")}</button>)}</div>
    </Modal>
  );
}
