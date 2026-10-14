"use client";

import { ArrowLeft, KeyRound } from "lucide-react";
import { useState } from "react";
import { ROLE_LABEL, ROLE_MODULES, MODULES } from "../data";
import { longDate } from "../money";
import { useStore } from "../store";
import { Avatar, PinPad, cx, useNow } from "../ui";

export function SignIn() {
  const { state, api } = useStore();
  const [sel, setSel] = useState<string | null>(null);
  const [err, setErr] = useState(0);
  const now = useNow(30000);
  const staff = state.staff;
  const chosen = staff.find((s) => s.id === sel);
  const sales = state.orders.filter((o) => o.status !== "void" && o.status !== "open").length;

  const submit = (pin: string) => {
    if (!chosen) return;
    if (!api.signIn(chosen.id, pin)) setErr((e) => e + 1);
  };

  return (
    <div className="signin">
      <aside className="signin-left">
        <div className="wordmark self-start"><i />Lush View<small>POS</small></div>
        <div>
          <div className="kicker" style={{ color: "var(--ink4)" }}>{longDate(now)} · Osu, Accra</div>
          <h1 className="signin-h mt-4">Good evening.<br />Who's <em>on shift?</em></h1>
          <p className="mt-5 max-w-[34ch] text-[15px] text-[#d6cfbd]">
            One till, one kitchen screen, one back office. Your PIN decides what you see — a cashier gets the till, the accountant gets the books, the cook gets the pass.
          </p>
        </div>
        <div className="mb-6 grid grid-cols-3 gap-3">
          <div className="rounded-2xl bg-white/5 p-4"><div className="kicker" style={{ color: "var(--ink4)" }}>Orders today</div><div className="d mt-2 text-[28px] font-extrabold text-[var(--sun)]">{sales}</div></div>
          <div className="rounded-2xl bg-white/5 p-4"><div className="kicker" style={{ color: "var(--ink4)" }}>Tables open</div><div className="d mt-2 text-[28px] font-extrabold text-[var(--sun)]">{state.tables.filter((t) => t.status === "open").length}</div></div>
          <div className="rounded-2xl bg-white/5 p-4"><div className="kicker" style={{ color: "var(--ink4)" }}>At the pass</div><div className="d mt-2 text-[28px] font-extrabold text-[var(--sun)]">{state.tickets.filter((t) => t.status !== "bumped").length}</div></div>
        </div>
      </aside>

      <section className="flex min-h-full items-center justify-center p-8 md:p-12">
        {!chosen ? (
          <div className="w-full max-w-[720px]">
            <div className="kicker">Step 1 of 2</div>
            <h2 className="page-title mt-2">Pick your name</h2>
            <p className="page-sub">Then enter your 4-digit PIN.</p>
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {staff.map((s) => (
                <button key={s.id} type="button" className={cx("staffcard", !s.active && "is-off")} onClick={() => { setErr(0); setSel(s.id); }} disabled={!s.active}>
                  <Avatar initials={s.initials} tone={s.color} size="lg" />
                  <span className="min-w-0">
                    <span className="d block text-[16px] font-bold">{s.name}</span>
                    <span className="block text-[12.5px] font-semibold text-[var(--ink3)]">{ROLE_LABEL[s.role]} · {ROLE_MODULES[s.role].length === MODULES.length ? "all modules" : `${ROLE_MODULES[s.role].length} module${ROLE_MODULES[s.role].length === 1 ? "" : "s"}`}</span>
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-6 text-[12.5px] font-semibold text-[var(--ink3)]">
              Demo PINs — {staff.map((s) => `${s.name.split(" ")[0]} ${s.pin}`).join(" · ")}
            </p>
          </div>
        ) : (
          <div className="w-full max-w-[380px]">
            <button type="button" className="btn btn-ghost btn-sm mb-6" onClick={() => setSel(null)}><ArrowLeft size={14} strokeWidth={3} /> Everyone</button>
            <div className="flex items-center gap-4">
              <Avatar initials={chosen.initials} tone={chosen.color} size="xl" />
              <div>
                <div className="kicker">Step 2 of 2</div>
                <h2 className="d mt-1 text-[26px] font-extrabold leading-none tracking-tight">{chosen.name}</h2>
                <div className="mt-1 text-[13px] font-semibold text-[var(--ink3)]">{ROLE_LABEL[chosen.role]} · PIN {chosen.pin} in this demo</div>
              </div>
            </div>
            <div className="card mt-6 p-5">
              <div className="mb-4 flex items-center justify-center gap-2 text-[13px] font-bold text-[var(--ink3)]"><KeyRound size={14} /> {err ? <span className="c-terra">Wrong PIN — try again</span> : "Enter your PIN"}</div>
              <PinPad key={err} onDone={submit} error={false} />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
