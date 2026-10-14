"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, BookOpen, ChefHat, ReceiptText, RotateCcw, Vault, Wifi, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { brand } from "@/content/site";
import { Particles } from "@/components/shared/Particles";
import { Drawer } from "./screens/Drawer";
import { Kitchen } from "./screens/Kitchen";
import { Till } from "./screens/Till";
import { DemoProvider, shiftTotals, useDemo, type Screen } from "./store";
import { Tour, useTourProgress } from "./Tour";
import { Chip, Modal, T, Toasts } from "./ui";

export function DemoShell() {
  return (
    <DemoProvider>
      <Shell />
    </DemoProvider>
  );
}

function Shell() {
  const { state, dispatch, now } = useDemo();
  const reduce = useReducedMotion();
  const totals = shiftTotals(state);
  const live = state.tickets.filter((t) => t.status !== "completed").length;
  const [guideSheet, setGuideSheet] = useState(false);
  const { count, total } = useTourProgress();

  // Keyboard: 1/2/3 switch screens, G toggles the guide, O toggles offline (when not typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const map: Record<string, Screen> = { "1": "till", "2": "kitchen", "3": "drawer" };
      if (map[e.key]) dispatch({ type: "screen", screen: map[e.key] });
      else if (e.key.toLowerCase() === "g") dispatch({ type: "tour", open: !state.tourOpen });
      else if (e.key.toLowerCase() === "o") dispatch({ type: "online", online: !state.online });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dispatch, state.tourOpen, state.online]);

  const tabs: { id: Screen; label: string; icon: React.ReactNode; badge?: string; tone?: "mint" | "amber" | "rose" }[] = [
    { id: "till", label: "Till", icon: <ReceiptText size={16} />, badge: totals.open.length ? `${totals.open.length} open` : undefined, tone: "amber" },
    { id: "kitchen", label: "Kitchen", icon: <ChefHat size={16} />, badge: live ? String(live) : undefined, tone: live ? "amber" : "mint" },
    { id: "drawer", label: "Drawer", icon: <Vault size={16} />, badge: state.shift.closedAt ? "closed" : undefined, tone: "rose" },
  ];

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-[#020c0a] text-emerald-50 selection:bg-emerald-400 selection:text-emerald-950">
      {/* Orbs backdrop */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-0">
        <div className="absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-emerald-700/25 blur-[120px]" />
        <div className="absolute -bottom-52 right-[-10%] h-[560px] w-[560px] rounded-full bg-amber-500/[.12] blur-[140px]" />
        <div className="absolute left-1/2 top-1/3 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-emerald-400/[.07] blur-[120px]" />
        <Particles className="absolute inset-0 opacity-50" />
        <div className="grain absolute inset-0 opacity-[.35] mix-blend-soft-light" />
      </div>

      {/* top bar */}
      <header className={`relative z-20 shrink-0 border-b ${T.line} bg-[rgba(2,12,10,.6)] backdrop-blur-xl`}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 sm:px-4">
          <a href="/orbs/" className="flex items-center gap-2 text-sm font-semibold" title="Back to the site">
            <img src={brand.logo} alt="" width={26} height={26} className="rounded-lg" />
            <span className="hidden sm:inline">{brand.name}</span>
          </a>
          <Chip tone="mint" className="hidden sm:inline-flex">Live demo</Chip>

          <nav aria-label="Screens" className={`order-last flex w-full gap-1 rounded-xl border ${T.line} bg-black/30 p-1 md:order-none md:mx-auto md:w-auto`}>
            {tabs.map((t) => {
              const active = state.screen === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => dispatch({ type: "screen", screen: t.id })}
                  className={`relative flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors md:flex-none md:px-4 ${active ? "text-emerald-950" : `${T.muted} hover:text-white`}`}
                >
                  {active && <motion.span layoutId="tab" transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }} className="absolute inset-0 rounded-lg bg-emerald-400" />}
                  <span className="relative flex items-center gap-2">
                    {t.icon}
                    {t.label}
                    {t.badge && (
                      <span className={`rounded-full px-1.5 py-0.5 text-[.62rem] font-black uppercase tracking-wider ${active ? "bg-emerald-950/15 text-emerald-950" : t.tone === "amber" ? "bg-amber-400/20 text-amber-200" : t.tone === "rose" ? "bg-rose-400/20 text-rose-200" : "bg-emerald-400/20 text-emerald-200"}`}>
                        {t.badge}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              role="switch"
              aria-checked={state.online}
              onClick={() => dispatch({ type: "online", online: !state.online })}
              className={`flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-xs font-bold transition-colors ${state.online ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-amber-400/40 bg-amber-400/15 text-amber-100"}`}
              title="Simulate a network drop (O)"
            >
              {state.online ? <Wifi size={14} /> : <WifiOff size={14} />}
              <span className="hidden sm:inline">{state.online ? "Online" : "Offline"}</span>
              <span className={`relative h-4 w-7 rounded-full transition-colors ${state.online ? "bg-emerald-400" : "bg-amber-400"}`}>
                <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-[#06160f] transition-all ${state.online ? "left-3.5" : "left-0.5"}`} />
              </span>
            </button>
            <span className={`hidden tabular text-sm lg:inline ${T.muted}`}>{new Date(now).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
            <button
              type="button"
              onClick={() => (window.matchMedia("(min-width: 1280px)").matches ? dispatch({ type: "tour", open: !state.tourOpen }) : setGuideSheet(true))}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-bold ${state.tourOpen ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : `${T.line} bg-white/5 ${T.muted} hover:text-white`}`}
              title="Guide (G)"
            >
              <BookOpen size={14} />
              <span className="hidden sm:inline">Guide</span>
              <span className="tabular">{count}/{total}</span>
            </button>
            <button type="button" onClick={() => dispatch({ type: "reset" })} className={`grid h-8 w-8 place-items-center rounded-full border ${T.line} bg-white/5 ${T.muted} hover:text-white`} title="Reset demo">
              <RotateCcw size={14} />
            </button>
            <a href="/orbs/" className={`hidden h-8 items-center gap-1.5 rounded-full border ${T.line} bg-white/5 px-3 text-xs font-bold ${T.muted} hover:text-white sm:flex`}>
              <ArrowLeft size={13} /> Site
            </a>
          </div>
        </div>
        <AnimatePresence>
          {!state.online && (
            <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden bg-amber-400 text-center text-xs font-bold text-amber-950">
              <span className="block py-1">Offline — selling from this device. {totals.queued ? `${totals.queued} sale${totals.queued > 1 ? "s" : ""} queued.` : "Sales will queue and sync when the network is back."}</span>
            </motion.p>
          )}
        </AnimatePresence>
      </header>

      {/* body */}
      <div className="relative z-10 flex min-h-0 flex-1">
        <main className="min-h-0 min-w-0 flex-1 p-3 sm:p-4">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={state.screen}
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -6 }}
              transition={{ duration: 0.22 }}
              className="h-full min-h-0"
            >
              {state.screen === "till" && <Till />}
              {state.screen === "kitchen" && <Kitchen />}
              {state.screen === "drawer" && <Drawer />}
            </motion.div>
          </AnimatePresence>
        </main>

        <AnimatePresence initial={false}>
          {state.tourOpen && (
            <motion.aside
              key="guide"
              initial={reduce ? false : { width: 0, opacity: 0 }}
              animate={{ width: 340, opacity: 1 }}
              exit={reduce ? undefined : { width: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
              className={`hidden shrink-0 overflow-hidden border-l ${T.line} bg-[rgba(2,12,10,.5)] backdrop-blur-xl xl:block`}
            >
              <div className="h-full w-[340px]">
                <Tour onClose={() => dispatch({ type: "tour", open: false })} />
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      <Modal open={guideSheet} onClose={() => setGuideSheet(false)} title="Run the shift" width="max-w-md">
        <div className="-m-5 h-[75dvh]">
          <Tour onClose={() => setGuideSheet(false)} />
        </div>
      </Modal>

      <Toasts />
    </div>
  );
}
