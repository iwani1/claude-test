"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { ROLES, type Perm } from "./data";
import { Audit } from "./screens/Audit";
import { Drawer } from "./screens/Drawer";
import { Floor } from "./screens/Floor";
import { Hardware } from "./screens/Hardware";
import { Kitchen } from "./screens/Kitchen";
import { Menu } from "./screens/Menu";
import { Orders } from "./screens/Orders";
import { Purchasing } from "./screens/Purchasing";
import { Recipes } from "./screens/Recipes";
import { Reports } from "./screens/Reports";
import { Settings } from "./screens/Settings";
import { SignIn } from "./screens/SignIn";
import { Staff } from "./screens/Staff";
import { Stock } from "./screens/Stock";
import { Till } from "./screens/Till";
import { Today } from "./screens/Today";
import { can, currentUser, DemoProvider, landing, shiftTotals, useDemo, type Screen } from "./store";
import { Tour, useTourProgress } from "./Tour";
import { K, Modal, Toasts } from "./ui";

export function DemoShell() {
  return (
    <DemoProvider>
      <Shell />
    </DemoProvider>
  );
}

type Item = { id: Screen; label: string; perm: Perm };
const GROUPS: { id: string; label: string; items: Item[] }[] = [
  { id: "today", label: "Today", items: [{ id: "today", label: "Today", perm: "reports" }] },
  {
    id: "service",
    label: "Service",
    items: [
      { id: "till", label: "Till", perm: "pos" },
      { id: "floor", label: "Floor", perm: "pos" },
      { id: "kitchen", label: "Kitchen", perm: "kds" },
      { id: "orders", label: "Orders", perm: "orders" },
    ],
  },
  {
    id: "stock",
    label: "Stock",
    items: [
      { id: "menu", label: "Menu", perm: "menu" },
      { id: "recipes", label: "Recipes & costing", perm: "menu" },
      { id: "stock", label: "Ingredients", perm: "stock" },
      { id: "purchasing", label: "Purchasing", perm: "stock" },
    ],
  },
  {
    id: "money",
    label: "Money",
    items: [
      { id: "drawer", label: "Drawer", perm: "drawer" },
      { id: "reports", label: "Reports", perm: "reports" },
      { id: "audit", label: "Audit trail", perm: "audit" },
    ],
  },
  {
    id: "setup",
    label: "Setup",
    items: [
      { id: "staff", label: "Staff & roles", perm: "staff" },
      { id: "settings", label: "Settings", perm: "settings" },
      { id: "hardware", label: "Hardware & tenders", perm: "settings" },
    ],
  },
];

const SCREENS: Record<Screen, () => React.ReactElement> = {
  today: Today,
  till: Till,
  floor: Floor,
  kitchen: Kitchen,
  orders: Orders,
  drawer: Drawer,
  reports: Reports,
  audit: Audit,
  menu: Menu,
  recipes: Recipes,
  stock: Stock,
  purchasing: Purchasing,
  staff: Staff,
  settings: Settings,
  hardware: Hardware,
};

function Shell() {
  const { state, dispatch, now } = useDemo();
  const reduce = useReducedMotion();
  const totals = shiftTotals(state);
  const live = state.tickets.filter((t) => t.status !== "completed").length;
  const [guideSheet, setGuideSheet] = useState(false);
  const { count, total } = useTourProgress();
  const day = state.theme === "day";
  const user = currentUser(state);

  const groups = GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => can(state, i.perm)) })).filter((g) => g.items.length);
  const permitted = groups.some((g) => g.items.some((i) => i.id === state.screen));
  const screen: Screen = permitted ? state.screen : landing(state);
  const group = groups.find((g) => g.items.some((i) => i.id === screen));
  const Screen = SCREENS[screen];

  // Keyboard: 1/2/3 Till · Kitchen · Drawer, G guide, O offline, T theme (when not typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const map: Record<string, Screen> = { "1": "till", "2": "kitchen", "3": "drawer" };
      const k = e.key.toLowerCase();
      if (map[e.key] && state.userId) dispatch({ type: "screen", screen: map[e.key] });
      else if (k === "g") dispatch({ type: "tour", open: !state.tourOpen });
      else if (k === "o") dispatch({ type: "online", online: !state.online });
      else if (k === "t") dispatch({ type: "theme", theme: state.theme === "day" ? "evening" : "day" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dispatch, state.tourOpen, state.online, state.theme, state.userId]);

  const clock = new Date(now).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const headH = 64 + (user && group && group.items.length > 1 ? 44 : 0);
  const badge = (id: Screen) => (id === "kitchen" && live ? live : id === "till" && totals.open.length ? totals.open.length : undefined);

  return (
    <div className="demo min-h-dvh" data-theme={day ? "day" : undefined} style={{ backgroundImage: "var(--glow)" }}>
      {/* ------------------------------------------------ header */}
      <header className={`sticky top-0 z-30 border-b ${K.line} bg-(--bg)/85 backdrop-blur-md`}>
        <div className="flex h-16 items-center gap-6 px-6 lg:px-14">
          <a href="/orbs/" className="flex items-baseline gap-3" title="Back to the site">
            <span className="font-serif text-[22px] italic leading-none tracking-[-.01em]">Lush View</span>
            <span className={`hidden text-[11px] font-semibold uppercase tracking-[.18em] sm:inline ${K.fg3}`}>Point of sale</span>
          </a>

          {user && (
            <nav aria-label="Areas" className="mx-auto flex items-center gap-7 lg:gap-9">
              {groups.map((g) => {
                const active = group?.id === g.id;
                return (
                  <button key={g.id} type="button" onClick={() => dispatch({ type: "screen", screen: g.items[0].id })} className={`relative flex h-16 items-center gap-2 text-[15px] transition-colors ${active ? K.fg : `${K.fg3} hover:text-(--fg)`}`}>
                    {g.label}
                    {g.id === "service" && live > 0 && !active && <span className={`font-serif lining text-[14px] ${K.accent}`}>{live}</span>}
                    {active && <motion.span layoutId="nav" transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }} className="absolute inset-x-0 -bottom-px h-px bg-(--accent)" />}
                  </button>
                );
              })}
            </nav>
          )}

          <div className={`ml-auto flex items-center gap-5 text-[13px] ${K.fg3}`}>
            {user && (
              <button type="button" onClick={() => dispatch({ type: "signOut" })} title="Sign out" className="transition-colors hover:text-(--fg)">
                <span className="text-(--fg2)">{user.name.split(" ")[0]}</span>
                <span className="hidden lg:inline"> · {ROLES[user.role].short}</span> · Sign out
              </button>
            )}
            <span className="hidden font-serif lining text-[15px] text-(--fg2) md:inline">{clock}</span>
            <button type="button" role="switch" aria-checked={state.online} onClick={() => dispatch({ type: "online", online: !state.online })} title="Simulate a network drop (O)" className={`flex items-center gap-2 transition-colors ${state.online ? "hover:text-(--fg)" : K.warn}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${state.online ? "bg-(--accent)" : "bg-(--warn)"}`} />
              {state.online ? "Online" : "Offline"}
            </button>
            <button type="button" onClick={() => dispatch({ type: "theme", theme: day ? "evening" : "day" })} title={day ? "Switch to evening (T)" : "Switch to day (T)"} aria-label={day ? "Switch to evening theme" : "Switch to day theme"} className="grid h-8 w-8 place-items-center rounded-full transition-colors hover:text-(--fg)">
              {day ? <Moon size={15} /> : <Sun size={15} />}
            </button>
            <button type="button" onClick={() => (window.matchMedia("(min-width: 1280px)").matches ? dispatch({ type: "tour", open: !state.tourOpen }) : setGuideSheet(true))} title="Guide (G)" className={`transition-colors hover:text-(--fg) ${state.tourOpen ? K.fg : ""}`}>
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

        {/* second row: the screens inside the active area */}
        {user && group && group.items.length > 1 && (
          <div className={`flex h-11 items-center gap-7 border-t ${K.line2} px-6 lg:px-14`}>
            {group.items.map((it) => {
              const active = it.id === screen;
              const n = badge(it.id);
              return (
                <button key={it.id} type="button" onClick={() => dispatch({ type: "screen", screen: it.id })} className={`relative flex h-11 items-center gap-2 text-[11px] font-semibold uppercase tracking-[.18em] transition-colors ${active ? K.fg : `${K.fg3} hover:text-(--fg2)`}`}>
                  {it.label}
                  {n !== undefined && <span className={`font-serif text-[13px] normal-case tracking-normal lining ${active ? K.fg2 : K.accent}`}>{n}</span>}
                  {active && <motion.span layoutId="subnav" transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }} className="absolute inset-x-0 -bottom-px h-px bg-(--fg)" />}
                </button>
              );
            })}
          </div>
        )}

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
            <motion.div key={user ? screen : "signin"} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? undefined : { opacity: 0, y: -8 }} transition={{ duration: 0.28, ease: [0.2, 0.7, 0.2, 1] }}>
              {user ? <Screen /> : <SignIn />}
            </motion.div>
          </AnimatePresence>
        </main>

        <AnimatePresence initial={false}>
          {state.tourOpen && (
            <motion.aside key="guide" initial={reduce ? false : { width: 0, opacity: 0 }} animate={{ width: 320, opacity: 1 }} exit={reduce ? undefined : { width: 0, opacity: 0 }} transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }} className={`sticky hidden shrink-0 overflow-hidden border-l ${K.line} xl:block`} style={{ top: headH, height: `calc(100dvh - ${headH}px)` }}>
              <div className="h-full w-[320px]">
                <Tour onClose={() => dispatch({ type: "tour", open: false })} />
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      <Modal open={guideSheet} onClose={() => setGuideSheet(false)} kicker="Guide" title="Run the whole system" width="max-w-md">
        <div className="-mx-8 -mb-8 h-[70dvh]">
          <Tour onClose={() => setGuideSheet(false)} embedded />
        </div>
      </Modal>

      <Toasts />
    </div>
  );
}
