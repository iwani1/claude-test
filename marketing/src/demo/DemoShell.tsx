"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Drawer } from "./screens/Drawer";
import { Kitchen } from "./screens/Kitchen";
import { Till } from "./screens/Till";
import { DemoProvider, shiftTotals, useDemo, type Screen } from "./store";
import { Tour, useTourProgress } from "./Tour";
import { K, Modal, Toasts } from "./ui";

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
  const day = state.theme === "day";

  // Keyboard: 1/2/3 switch screens, G toggles the guide, O toggles offline, T flips day/evening (when not typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const map: Record<string, Screen> = { "1": "till", "2": "kitchen", "3": "drawer" };
      const k = e.key.toLowerCase();
      if (map[e.key]) dispatch({ type: "screen", screen: map[e.key] });
      else if (k === "g") dispatch({ type: "tour", open: !state.tourOpen });
      else if (k === "o") dispatch({ type: "online", online: !state.online });
      else if (k === "t") dispatch({ type: "theme", theme: state.theme === "day" ? "evening" : "day" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dispatch, state.tourOpen, state.online, state.theme]);

  const nav: { id: Screen; label: string; count?: number; hot?: boolean }[] = [
    { id: "till", label: "Till", count: totals.open.length || undefined },
    { id: "kitchen", label: "Kitchen", count: live || undefined, hot: live > 0 },
    { id: "drawer", label: "Drawer" },
  ];
  const clock = new Date(now).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="demo min-h-dvh" data-theme={day ? "day" : undefined} style={{ backgroundImage: "var(--glow)" }}>
      {/* ------------------------------------------------ header */}
      <header className={`sticky top-0 z-30 border-b ${K.line} bg-(--bg)/85 backdrop-blur-md`}>
        <div className="flex h-16 items-center gap-6 px-6 lg:px-14">
          <a href="/orbs/" className="flex items-baseline gap-3" title="Back to the site">
            <span className="font-serif text-[22px] italic leading-none tracking-[-.01em]">Lush View</span>
            <span className={`hidden text-[11px] font-semibold uppercase tracking-[.18em] sm:inline ${K.fg3}`}>Point of sale</span>
          </a>

          <nav aria-label="Screens" className="mx-auto flex items-center gap-8">
            {nav.map((n) => {
              const active = state.screen === n.id;
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => dispatch({ type: "screen", screen: n.id })}
                  className={`relative flex h-16 items-center gap-2 text-[15px] transition-colors ${active ? K.fg : `${K.fg3} hover:text-(--fg)`}`}
                >
                  {n.label}
                  {n.count !== undefined && <span className={`font-serif lining text-[14px] ${n.hot && !active ? K.accent : K.fg3}`}>{n.count}</span>}
                  {active && <motion.span layoutId="nav" transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }} className="absolute inset-x-0 -bottom-px h-px bg-(--accent)" />}
                </button>
              );
            })}
          </nav>

          <div className={`flex items-center gap-5 text-[13px] ${K.fg3}`}>
            <span className="hidden xl:inline">Shift 2 · Ama</span>
            <span className="hidden font-serif lining text-[15px] text-(--fg2) lg:inline">{clock}</span>
            <button
              type="button"
              role="switch"
              aria-checked={state.online}
              onClick={() => dispatch({ type: "online", online: !state.online })}
              title="Simulate a network drop (O)"
              className={`flex items-center gap-2 transition-colors ${state.online ? "hover:text-(--fg)" : K.warn}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${state.online ? "bg-(--accent)" : "bg-(--warn)"}`} />
              {state.online ? "Online" : "Offline"}
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: "theme", theme: day ? "evening" : "day" })}
              title={day ? "Switch to evening (T)" : "Switch to day (T)"}
              aria-label={day ? "Switch to evening theme" : "Switch to day theme"}
              className="grid h-8 w-8 place-items-center rounded-full transition-colors hover:text-(--fg)"
            >
              {day ? <Moon size={15} /> : <Sun size={15} />}
            </button>
            <button
              type="button"
              onClick={() => (window.matchMedia("(min-width: 1280px)").matches ? dispatch({ type: "tour", open: !state.tourOpen }) : setGuideSheet(true))}
              title="Guide (G)"
              className={`transition-colors hover:text-(--fg) ${state.tourOpen ? K.fg : ""}`}
            >
              Guide <span className="font-serif lining text-[14px]">{count}/{total}</span>
            </button>
            <button type="button" onClick={() => dispatch({ type: "reset" })} title="Reset the demo" className="hidden transition-colors hover:text-(--fg) sm:inline">
              Reset
            </button>
            <a href="/orbs/" className="hidden transition-colors hover:text-(--fg) md:inline">
              ← Site
            </a>
          </div>
        </div>
        <AnimatePresence>
          {!state.online && (
            <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className={`overflow-hidden border-t ${K.line} text-center text-xs ${K.warn}`}>
              <span className="block py-1.5">Offline — selling from this device. {totals.queued ? `${totals.queued} sale${totals.queued > 1 ? "s" : ""} queued to sync.` : "Sales queue here and sync when the network is back."}</span>
            </motion.p>
          )}
        </AnimatePresence>
      </header>

      {/* ------------------------------------------------ body */}
      <div className="flex">
        <main className="min-w-0 flex-1">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={state.screen}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: 0.28, ease: [0.2, 0.7, 0.2, 1] }}
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
              animate={{ width: 320, opacity: 1 }}
              exit={reduce ? undefined : { width: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
              className={`sticky top-16 hidden h-[calc(100dvh-64px)] shrink-0 overflow-hidden border-l ${K.line} xl:block`}
            >
              <div className="h-full w-[320px]">
                <Tour onClose={() => dispatch({ type: "tour", open: false })} />
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      <Modal open={guideSheet} onClose={() => setGuideSheet(false)} kicker="Guide" title="Run the shift" width="max-w-md">
        <div className="-mx-8 -mb-8 h-[70dvh]">
          <Tour onClose={() => setGuideSheet(false)} embedded />
        </div>
      </Modal>

      <Toasts />
    </div>
  );
}
