"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { ROLES, type Staff } from "../data";
import { useDemo, type Action } from "../store";
import { Caps, K, Num, PinPad, TextLink, timeOf } from "../ui";

type PinIO = { pinRef: { current: string }; setPin: (v: string) => void; setWrong: (f: (n: number) => number) => void; dispatch: (a: Action) => void };

/** Both the on-screen pad and a physical keyboard funnel through here; four digits submit. */
function enterPin(v: string, user: Staff, io: PinIO) {
  io.pinRef.current = v;
  io.setPin(v);
  if (v.length < 4) return;
  if (v === user.pin) io.dispatch({ type: "signIn", userId: user.id });
  else {
    io.setWrong((n) => n + 1);
    io.pinRef.current = "";
    io.setPin("");
  }
}

export function SignIn() {
  const { state, dispatch, now } = useDemo();
  const [who, setWho] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [wrong, setWrong] = useState(0);
  const user = state.staff.find((u) => u.id === who);
  const hour = new Date(now).getHours();
  const greeting = hour < 12 ? "Good morning." : hour < 17 ? "Good afternoon." : "Good evening.";

  const pinRef = useRef("");
  const io = { pinRef, setPin, setWrong, dispatch };

  // A physical keyboard works too: digits type the PIN, Backspace deletes, Escape goes back to the list.
  useEffect(() => {
    if (!user) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^\d$/.test(e.key)) enterPin((pinRef.current + e.key).slice(0, 4), user, { pinRef, setPin, setWrong, dispatch });
      else if (e.key === "Backspace") enterPin(pinRef.current.slice(0, -1), user, { pinRef, setPin, setWrong, dispatch });
      else if (e.key === "Escape") setWho(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [user, dispatch]);

  return (
    <div className="grid min-h-[calc(100dvh-64px)] lg:grid-cols-[minmax(0,1fr)_480px]">
      {/* ------------------------------------------------ who */}
      <section className="px-6 pb-16 pt-12 lg:px-14 lg:pt-16">
        <Caps>{state.settings.name}</Caps>
        <h1 className="mt-3 font-serif text-[clamp(44px,5vw,72px)] font-light italic leading-[.95] tracking-[-.03em]">{greeting}</h1>
        <p className={`mt-5 max-w-[44ch] text-sm leading-relaxed ${K.fg2}`}>
          Who’s on the terminal? Each person signs in with a PIN and sees only what their role allows — a cashier gets the till and the pass, the owner gets everything. Nothing here is real.
        </p>

        <ul className={`mt-12 max-w-[560px] border-t ${K.line}`}>
          {state.staff.map((u) => {
            const role = ROLES[u.role];
            const on = who === u.id;
            return (
              <li key={u.id} className={`border-b ${K.line2}`}>
                <button
                  type="button"
                  disabled={!role.terminal || !u.active}
                  onClick={() => {
                    setWho(u.id);
                    pinRef.current = "";
                    setPin("");
                    setWrong(0);
                  }}
                  className={`group flex w-full items-baseline justify-between gap-6 py-4 text-left transition-colors disabled:cursor-not-allowed ${on ? K.fg : role.terminal && u.active ? `${K.fg2} hover:text-(--fg)` : K.fg3}`}
                >
                  <span className="flex items-baseline gap-4">
                    <Num italic className={`text-[24px] ${on ? K.accent : ""}`}>
                      {u.name}
                    </Num>
                    <span className={`text-[11px] font-semibold uppercase tracking-[.18em] ${on ? K.fg2 : K.fg3}`}>{role.short}</span>
                  </span>
                  <span className={`text-xs ${K.fg3}`}>{!u.active ? "deactivated" : !role.terminal ? "no terminal access" : u.lastLogin ? `last in ${timeOf(u.lastLogin)}` : on ? "enter PIN →" : ""}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className={`mt-6 text-xs ${K.fg3}`}>Demo PINs: owner 1111 · manager 2222 · cashiers 3333 / 3434 · stock 4444 · finance 5555.</p>
      </section>

      {/* ------------------------------------------------ pin */}
      <aside className={`flex flex-col justify-center border-t px-6 py-12 lg:border-l lg:border-t-0 lg:px-14 ${K.line}`}>
        <AnimatePresence mode="wait">
          {user ? (
            <motion.div key={user.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
              <div className="text-center">
                <Caps>{ROLES[user.role].label}</Caps>
                <p className="mt-2 font-serif text-[32px] italic leading-none tracking-[-.01em]">{user.name}</p>
                <motion.p key={wrong} animate={wrong ? { x: [0, -6, 6, -4, 4, 0] } : undefined} transition={{ duration: 0.35 }} className={`mt-3 text-sm ${wrong ? K.warn : K.fg3}`}>
                  {wrong ? `That PIN isn’t right — try ${user.pin}` : "Enter your four-digit PIN"}
                </motion.p>
              </div>
              <div className="mt-10">
                <PinPad value={pin} onChange={(v) => enterPin(v, user, io)} />
              </div>
              <div className="mt-10 flex items-center justify-center gap-8">
                <TextLink tone="fg3" arrow={false} onClick={() => setWho(null)}>
                  Someone else
                </TextLink>
                <TextLink onClick={() => dispatch({ type: "signIn", userId: user.id })}>Skip the PIN</TextLink>
              </div>
            </motion.div>
          ) : (
            <motion.div key="none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center">
              <p className={`font-serif text-[28px] italic ${K.fg3}`}>Pick a name to begin.</p>
              <p className={`mx-auto mt-4 max-w-[30ch] text-sm leading-relaxed ${K.fg3}`}>Start as Kofi, the owner, to see the whole system; come back as Ama to see how little a cashier is shown.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </aside>
    </div>
  );
}
