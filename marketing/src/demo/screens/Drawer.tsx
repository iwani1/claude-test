"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { ghs } from "../pricing";
import { movements, shiftTotals, useDemo } from "../store";
import { Caps, Field, inputCls, K, Modal, Money, Num, Pill, TextLink, timeOf } from "../ui";

export function Drawer() {
  const { state, dispatch, now } = useDemo();
  const t = shiftTotals(state);
  const list = movements(state);
  const [payout, setPayout] = useState(false);
  const [closing, setClosing] = useState(false);
  const closed = Boolean(state.shift.closedAt);
  const hours = Math.max(1, (now - state.shift.openedAt) / 3_600_000);

  return (
    <div className="px-6 pb-16 pt-8 lg:px-14">
      {/* ------------------------------------------------ head */}
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
        <div>
          <Caps>Shift 2 · {state.shift.openedBy}</Caps>
          <h1 className="mt-1 font-serif text-[40px] italic leading-none tracking-[-.02em]">{closed ? "Shift closed." : "Shift in progress."}</h1>
          <p className={`mt-3 text-sm ${K.fg2}`}>
            Opened {timeOf(state.shift.openedAt)} with a float of {ghs(state.shift.floatCents)}
            {closed ? ` · closed ${timeOf(state.shift.closedAt!)}` : ` · ${t.paid.length} orders paid · ${ghs(Math.round(t.sales / hours))} an hour`}
          </p>
        </div>
        <div className="flex items-center gap-8">
          {closed ? (
            <Pill tone="accent" className="!w-auto" onClick={() => dispatch({ type: "newShift" })}>
              Start a new shift
            </Pill>
          ) : (
            <>
              <TextLink tone="fg2" onClick={() => setPayout(true)}>
                Record a payout
              </TextLink>
              <Pill tone="ghost" className="!w-auto" disabled={t.open.length > 0} title={t.open.length ? "Settle open tables first" : undefined} onClick={() => setClosing(true)}>
                End shift &amp; audit drawer
              </Pill>
            </>
          )}
        </div>
      </div>
      {!closed && t.open.length > 0 && (
        <p className={`mt-4 text-xs ${K.warn}`}>
          {t.open.length} table{t.open.length > 1 ? "s" : ""} still open — the real till won’t close a shift with unsettled orders either.
        </p>
      )}

      {/* ------------------------------------------------ four numbers */}
      <dl className={`mt-10 grid gap-8 border-y ${K.line} py-8 sm:grid-cols-2 xl:grid-cols-4 xl:gap-0 xl:divide-x xl:divide-(--line)`}>
        <Stat label="Sales incl. VAT" cents={t.sales} sub={`${t.paid.length} orders`} tone="accent" first />
        <Stat label="Cash expected in drawer" cents={t.expectedCents} sub={`float ${ghs(state.shift.floatCents)} + cash ${ghs(t.cash)} − payouts ${ghs(t.payouts)}`} />
        <Stat label="Mobile Money" cents={t.momo} sub={t.queued ? `${t.queued} sale${t.queued > 1 ? "s" : ""} waiting to sync` : "all settled with the provider"} warn={t.queued > 0} />
        <Stat label="VAT collected · 15 %" cents={t.vat} sub={t.roomCharges ? `incl. VAT on ${ghs(t.roomCharges)} room charges` : "on food, drink and room charges"} />
      </dl>

      {/* ------------------------------------------------ ledger + aside */}
      <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-16">
        <section>
          <div className="flex items-baseline justify-between">
            <Caps>Drawer ledger</Caps>
            <span className={`text-xs ${K.fg3}`}>{list.length} movements · newest first</span>
          </div>
          <table className="mt-4 w-full text-sm">
            <thead className={`text-left text-[11px] font-semibold uppercase tracking-[.18em] ${K.fg3}`}>
              <tr className={`border-b ${K.line}`}>
                <th className="py-2 pr-4 font-semibold">Time</th>
                <th className="py-2 pr-4 font-semibold">Movement</th>
                <th className="py-2 pr-4 text-right font-semibold">Cash</th>
                <th className="py-2 text-right font-semibold">MoMo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-(--line2)">
              {list.map((m, i) => {
                const queued = m.label.includes("queued");
                return (
                  <motion.tr key={m.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i, 12) * 0.03 }}>
                    <td className={`py-3 pr-4 ${K.fg3}`}>
                      <Num>{timeOf(m.at)}</Num>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`mr-3 text-[11px] font-semibold uppercase tracking-[.16em] ${m.kind === "payout" ? K.bad : queued ? K.warn : K.fg3}`}>{m.kind === "float" ? "Float" : m.kind === "payout" ? "Out" : queued ? "Queued" : "Sale"}</span>
                      <span className={K.fg2}>{m.label.replace(" · queued", "")}</span>
                    </td>
                    <td className={`py-3 pr-4 text-right ${m.cashCents < 0 ? K.bad : m.cashCents ? K.fg : K.fg3}`}>{m.cashCents ? <Num className="text-[16px]">{ghs(m.cashCents, true)}</Num> : "—"}</td>
                    <td className={`py-3 text-right ${m.momoCents ? K.fg : K.fg3}`}>{m.momoCents ? <Num className="text-[16px]">{ghs(m.momoCents, true)}</Num> : "—"}</td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <aside className={`border-t pt-6 lg:border-l lg:border-t-0 lg:pl-12 lg:pt-0 ${K.line}`}>
          {closed ? (
            <ClosedSummary />
          ) : (
            <>
              <Caps>What the audit checks</Caps>
              <ul className={`mt-4 space-y-4 text-sm leading-relaxed ${K.fg2}`}>
                <li>Expected cash is computed from the ledger — the cashier never types it.</li>
                <li>Mobile Money is reconciled separately against provider references.</li>
                <li>Over / short is recorded on the shift with the counted amount, and can’t be edited afterwards.</li>
                <li>Payouts need a reason, and sit in the ledger next to sales.</li>
              </ul>
            </>
          )}
        </aside>
      </div>

      <PayoutModal open={payout} onClose={() => setPayout(false)} />
      <CloseModal open={closing} onClose={() => setClosing(false)} />
    </div>
  );
}

function Stat({ label, cents, sub, tone = "fg", warn = false, first = false }: { label: string; cents: number; sub: string; tone?: "fg" | "accent"; warn?: boolean; first?: boolean }) {
  return (
    <div className={first ? "" : "xl:pl-8"}>
      <dt>
        <Caps>{label}</Caps>
      </dt>
      <dd className="mt-3">
        <Money cents={cents} size="lg" tone={tone} />
      </dd>
      <dd className={`mt-2 truncate text-xs ${warn ? K.warn : K.fg3}`} title={sub}>
        {sub}
      </dd>
    </div>
  );
}

function ClosedSummary() {
  const { state } = useDemo();
  const t = shiftTotals(state);
  const diff = (state.shift.countedCents ?? 0) - t.expectedCents;
  return (
    <div>
      <Caps>Audit result</Caps>
      <dl className={`mt-4 space-y-2 text-sm ${K.fg2}`}>
        <div className="flex justify-between">
          <dt>Expected drawer total</dt>
          <dd>
            <Num className="text-(--fg)">{ghs(t.expectedCents)}</Num>
          </dd>
        </div>
        <div className="flex justify-between">
          <dt>Counted cash</dt>
          <dd>
            <Num className="text-(--fg)">{ghs(state.shift.countedCents ?? 0)}</Num>
          </dd>
        </div>
      </dl>
      <div className={`mt-5 border-t ${K.line} pt-5`}>
        <Caps tone={diff === 0 ? "accent" : "fg3"}>{diff === 0 ? "Balanced" : diff > 0 ? "Over by" : "Short by"}</Caps>
        <div className="mt-2">
          <Money cents={Math.abs(diff)} size="lg" tone={diff === 0 ? "accent" : "fg"} />
        </div>
      </div>
      <p className={`mt-5 text-xs leading-relaxed ${K.fg3}`}>Locked. In the real app this lands in the owner’s shift history with the cashier’s name.</p>
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
    <Modal open={open} onClose={onClose} kicker="Drawer" title="Cash payout">
      <div className="space-y-7">
        <Field label="Amount (GH₵)">
          <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="50.00" className={`${inputCls} font-serif text-[40px] lining`} />
        </Field>
        <Field label="Reason" hint="Required — it shows in the ledger and on the shift report.">
          <input value={reason} onChange={(e) => setReason(e.target.value.slice(0, 60))} placeholder="Tomatoes from the market" className={inputCls} />
        </Field>
        <Pill
          tone="accent"
          disabled={!ok}
          right={ok ? ghs(cents) : undefined}
          onClick={() => {
            dispatch({ type: "payout", amountCents: cents, reason: reason.trim() });
            setAmount("");
            setReason("");
            onClose();
          }}
        >
          Record payout
        </Pill>
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
    <Modal open={open} onClose={onClose} kicker="End of shift" title="Count the drawer">
      <dl className={`space-y-2 text-sm ${K.fg2}`}>
        <div className="flex justify-between">
          <dt>Opening float</dt>
          <dd>
            <Num>{ghs(state.shift.floatCents)}</Num>
          </dd>
        </div>
        <div className="flex justify-between">
          <dt>Cash sales</dt>
          <dd>
            <Num>{ghs(t.cash, true)}</Num>
          </dd>
        </div>
        <div className="flex justify-between">
          <dt>Payouts</dt>
          <dd className={t.payouts ? K.bad : ""}>
            <Num>{t.payouts ? ghs(-t.payouts, true) : "—"}</Num>
          </dd>
        </div>
        <div className={`flex items-baseline justify-between border-t ${K.line} pt-3 text-(--fg)`}>
          <dt>Expected in drawer</dt>
          <dd>
            <Money cents={t.expectedCents} size="md" />
          </dd>
        </div>
      </dl>
      <div className="mt-8 space-y-7">
        <Field label="Counted cash (GH₵)" hint="Count the notes and coins, type the total. Try the exact amount, then try GH₵ 20 short.">
          <input autoFocus inputMode="decimal" value={counted} onChange={(e) => setCounted(e.target.value)} placeholder={(t.expectedCents / 100).toFixed(2)} className={`${inputCls} font-serif text-[56px] font-light italic lining tracking-[-.03em]`} />
        </Field>
        <div className={`flex items-baseline justify-between border-t ${K.line} pt-4`}>
          <Caps tone={valid && diff === 0 ? "accent" : "fg3"}>{!valid ? "Waiting for a count" : diff === 0 ? "Drawer balances" : diff > 0 ? "Over by" : "Short by"}</Caps>
          {valid ? <Money cents={Math.abs(diff)} size="md" tone={diff === 0 ? "accent" : "fg"} /> : <span className={K.fg3}>—</span>}
        </div>
        <Pill
          tone="accent"
          disabled={!valid}
          onClick={() => {
            dispatch({ type: "closeShift", countedCents: cents });
            setCounted("");
            onClose();
          }}
        >
          Close shift
        </Pill>
      </div>
    </Modal>
  );
}
