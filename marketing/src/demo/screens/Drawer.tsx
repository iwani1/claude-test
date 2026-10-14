"use client";

import { motion } from "motion/react";
import { ArrowDownToLine, Lock, RefreshCw, Sparkles } from "lucide-react";
import { useState } from "react";
import { ghs } from "../pricing";
import { movements, shiftTotals, useDemo } from "../store";
import { Btn, Chip, Field, inputCls, Modal, Panel, T, timeOf } from "../ui";

export function Drawer() {
  const { state, dispatch, now } = useDemo();
  const t = shiftTotals(state);
  const list = movements(state);
  const [payout, setPayout] = useState(false);
  const [closing, setClosing] = useState(false);
  const closed = Boolean(state.shift.closedAt);
  const hours = Math.max(1, (now - state.shift.openedAt) / 3_600_000);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto pb-6 lg:overflow-hidden lg:pb-0">
      <div className="flex flex-wrap items-center gap-3 px-1">
        <div>
          <p className="font-serif text-xl italic text-emerald-100">{closed ? "Shift closed" : "Shift in progress"}</p>
          <p className={`text-sm ${T.muted}`}>
            Opened {timeOf(state.shift.openedAt)} by {state.shift.openedBy} · float {ghs(state.shift.floatCents)}
            {closed && ` · closed ${timeOf(state.shift.closedAt!)}`}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          {closed ? (
            <Btn tone="mint" onClick={() => dispatch({ type: "newShift" })}>
              <RefreshCw size={15} /> Start a new shift
            </Btn>
          ) : (
            <>
              <Btn onClick={() => setPayout(true)}>
                <ArrowDownToLine size={15} /> Payout
              </Btn>
              <Btn tone="amber" onClick={() => setClosing(true)} disabled={t.open.length > 0} title={t.open.length ? "Settle open tables first" : undefined}>
                <Lock size={15} /> End shift &amp; audit drawer
              </Btn>
            </>
          )}
        </div>
      </div>
      {!closed && t.open.length > 0 && (
        <p className="px-1 text-xs text-amber-200/90">
          {t.open.length} table{t.open.length > 1 ? "s" : ""} still open — the real till won’t close a shift with unsettled orders either.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Sales (incl. VAT)" value={ghs(t.sales)} sub={`${t.paid.length} orders · ${ghs(Math.round(t.sales / hours))}/hr`} accent />
        <Stat label="Cash in drawer (expected)" value={ghs(t.expectedCents)} sub={`float ${ghs(state.shift.floatCents)} + cash ${ghs(t.cash)} − payouts ${ghs(t.payouts)}`} />
        <Stat label="Mobile Money" value={ghs(t.momo)} sub={t.queued ? `${t.queued} sale${t.queued > 1 ? "s" : ""} waiting to sync` : "all settled"} warn={t.queued > 0} />
        <Stat label="VAT collected (15 %)" value={ghs(t.vat)} sub={t.roomCharges ? `incl. VAT on ${ghs(t.roomCharges)} room charges` : "on food, drink and room charges"} />
      </div>

      <div className="grid gap-3 lg:min-h-0 lg:flex-1 lg:grid-cols-[1fr_340px] lg:grid-rows-[minmax(0,1fr)]">
        <Panel className="flex flex-col overflow-hidden lg:min-h-0">
          <div className={`flex items-center justify-between border-b ${T.line} px-4 py-3`}>
            <p className="font-bold">Drawer ledger</p>
            <p className={`text-xs ${T.muted}`}>{list.length} movements</p>
          </div>
          <div className="max-h-[55dvh] overflow-y-auto lg:max-h-none lg:min-h-0 lg:flex-1">
            <table className="w-full text-sm">
              <thead className={`sticky top-0 bg-[#06160f] text-left text-[.68rem] uppercase tracking-wider ${T.muted}`}>
                <tr>
                  <th className="px-4 py-2 font-semibold">Time</th>
                  <th className="px-2 py-2 font-semibold">Movement</th>
                  <th className="px-2 py-2 text-right font-semibold">Cash</th>
                  <th className="px-4 py-2 text-right font-semibold">MoMo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-50/[.06]">
                {list.map((m, i) => (
                  <motion.tr key={m.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i, 12) * 0.03 }}>
                    <td className={`px-4 py-2 tabular ${T.muted}`}>{timeOf(m.at)}</td>
                    <td className="px-2 py-2">
                      <span className="flex items-center gap-2">
                        {m.kind === "float" && <Chip tone="sky" className="!py-0.5">Float</Chip>}
                        {m.kind === "payout" && <Chip tone="rose" className="!py-0.5">Out</Chip>}
                        {m.kind === "sale" && <Chip tone={m.label.includes("queued") ? "amber" : "mint"} className="!py-0.5">{m.label.includes("queued") ? "Queued" : "Sale"}</Chip>}
                        <span className="truncate">{m.label.replace(" · queued", "")}</span>
                      </span>
                    </td>
                    <td className={`px-2 py-2 text-right tabular font-semibold ${m.cashCents < 0 ? "text-rose-300" : m.cashCents ? "" : T.muted}`}>{m.cashCents ? ghs(m.cashCents, true) : "—"}</td>
                    <td className={`px-4 py-2 text-right tabular font-semibold ${m.momoCents ? "text-amber-200" : T.muted}`}>{m.momoCents ? ghs(m.momoCents, true) : "—"}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel className="self-start p-4">
          {closed ? <ClosedSummary /> : (
            <>
              <p className="font-bold">What the audit checks</p>
              <ul className={`mt-3 space-y-2.5 text-sm ${T.muted}`}>
                <li className="flex gap-2"><Sparkles size={15} className={`mt-0.5 shrink-0 ${T.mint}`} /> Expected cash is computed from the ledger — the cashier never types it.</li>
                <li className="flex gap-2"><Sparkles size={15} className={`mt-0.5 shrink-0 ${T.mint}`} /> MoMo is reconciled separately against provider references.</li>
                <li className="flex gap-2"><Sparkles size={15} className={`mt-0.5 shrink-0 ${T.mint}`} /> Over / short is recorded on the shift, with the counted amount, and can’t be edited afterwards.</li>
                <li className="flex gap-2"><Sparkles size={15} className={`mt-0.5 shrink-0 ${T.mint}`} /> Payouts need a reason, and sit in the ledger next to sales.</li>
              </ul>
            </>
          )}
        </Panel>
      </div>

      <PayoutModal open={payout} onClose={() => setPayout(false)} />
      <CloseModal open={closing} onClose={() => setClosing(false)} />
    </div>
  );
}

function Stat({ label, value, sub, accent = false, warn = false }: { label: string; value: string; sub: string; accent?: boolean; warn?: boolean }) {
  return (
    <Panel className={`p-4 ${accent ? "border-emerald-400/30 bg-emerald-400/[.07]" : ""}`}>
      <p className={`text-[.68rem] font-semibold uppercase tracking-wider ${T.muted}`}>{label}</p>
      <p className={`mt-1 tabular text-2xl font-black tracking-tight ${accent ? T.mint : ""}`}>{value}</p>
      <p className={`mt-1 truncate text-xs ${warn ? "text-amber-200" : T.muted}`} title={sub}>{sub}</p>
    </Panel>
  );
}

function ClosedSummary() {
  const { state } = useDemo();
  const t = shiftTotals(state);
  const diff = (state.shift.countedCents ?? 0) - t.expectedCents;
  return (
    <div>
      <p className="font-bold">Audit result</p>
      <dl className="mt-3 space-y-1.5 text-sm">
        <div className="flex justify-between"><dt className={T.muted}>Expected drawer total</dt><dd className="tabular">{ghs(t.expectedCents)}</dd></div>
        <div className="flex justify-between"><dt className={T.muted}>Counted cash</dt><dd className="tabular">{ghs(state.shift.countedCents ?? 0)}</dd></div>
        <div className={`mt-2 flex items-center justify-between rounded-xl border px-3 py-2 ${diff === 0 ? "border-emerald-400/30 bg-emerald-400/10" : "border-amber-400/30 bg-amber-400/10"}`}>
          <dt className="font-semibold">{diff === 0 ? "Balanced" : diff > 0 ? "Over" : "Short"}</dt>
          <dd className="tabular text-lg font-black">{ghs(Math.abs(diff))}</dd>
        </div>
      </dl>
      <p className={`mt-3 text-xs ${T.muted}`}>Locked. In the real app this row lands in the owner’s shift history with the cashier’s name.</p>
    </div>
  );
}

function PayoutModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { dispatch } = useDemo();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const cents = Math.round(Number(amount) * 100);
  const ok = Number.isFinite(cents) && cents > 0 && reason.trim().length >= 3;
  return (
    <Modal open={open} onClose={onClose} title="Cash payout">
      <div className="space-y-3">
        <Field label="Amount (GH₵)">
          <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="50.00" className={`${inputCls} tabular text-lg font-bold`} />
        </Field>
        <Field label="Reason" hint="Required — it shows in the ledger and on the shift report.">
          <input value={reason} onChange={(e) => setReason(e.target.value.slice(0, 60))} placeholder="Tomatoes from the market" className={inputCls} />
        </Field>
        <Btn
          tone="amber"
          size="lg"
          className="w-full"
          disabled={!ok}
          onClick={() => {
            dispatch({ type: "payout", amountCents: cents, reason: reason.trim() });
            setAmount("");
            setReason("");
            onClose();
          }}
        >
          Record payout{ok ? ` of ${ghs(cents)}` : ""}
        </Btn>
      </div>
    </Modal>
  );
}

function CloseModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, dispatch } = useDemo();
  const t = shiftTotals(state);
  const [counted, setCounted] = useState("");
  const cents = Math.round(Number(counted) * 100);
  const valid = counted !== "" && Number.isFinite(cents) && cents >= 0;
  const diff = cents - t.expectedCents;
  return (
    <Modal open={open} onClose={onClose} title="End shift & cash drawer audit">
      <div className={`space-y-1.5 rounded-xl border ${T.line} bg-black/30 px-4 py-3 text-sm`}>
        <div className="flex justify-between"><span className={T.muted}>Opening cash float</span><span className="tabular">{ghs(state.shift.floatCents)}</span></div>
        <div className="flex justify-between"><span className={T.muted}>Total cash sales</span><span className="tabular text-emerald-300">{ghs(t.cash, true)}</span></div>
        <div className="flex justify-between"><span className={T.muted}>Cash outflows (payouts)</span><span className="tabular text-rose-300">{t.payouts ? ghs(-t.payouts, true) : "—"}</span></div>
        <div className={`flex justify-between border-t ${T.line} pt-2 font-bold`}><span>Expected drawer total</span><span className="tabular text-amber-300">{ghs(t.expectedCents)}</span></div>
      </div>
      <div className="mt-4 space-y-3">
        <Field label="Physically counted cash in drawer (GH₵)" hint="Count the notes and coins, type the total. Try the exact amount, then try GH₵ 20 short.">
          <input autoFocus inputMode="decimal" value={counted} onChange={(e) => setCounted(e.target.value)} placeholder={(t.expectedCents / 100).toFixed(2)} className={`${inputCls} tabular text-2xl font-black`} />
        </Field>
        <div className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm ${!valid ? `${T.line} bg-white/[.03]` : diff === 0 ? "border-emerald-400/30 bg-emerald-400/10" : "border-amber-400/30 bg-amber-400/10"}`}>
          <span className="font-semibold">{!valid ? "Waiting for a count" : diff === 0 ? "Drawer balances" : diff > 0 ? "Over by" : "Short by"}</span>
          <span className="tabular text-xl font-black">{valid ? ghs(Math.abs(diff)) : "—"}</span>
        </div>
        <Btn
          tone="mint"
          size="lg"
          className="w-full"
          disabled={!valid}
          onClick={() => {
            dispatch({ type: "closeShift", countedCents: cents });
            setCounted("");
            onClose();
          }}
        >
          <Lock size={16} /> Close shift
        </Btn>
      </div>
    </Modal>
  );
}
