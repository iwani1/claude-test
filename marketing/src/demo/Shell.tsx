"use client";

import "@fontsource-variable/sora";
import "@fontsource-variable/inter";
import "./sunbird.css";

import { ChevronDown, Compass, LayoutGrid, LogOut, RotateCcw, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { GROUPS, MODULES, ROLE_LABEL, can, type Group, type Module } from "./data";
import { hm } from "./money";
import { StoreProvider, currentUser, useStore } from "./store";
import { Tour } from "./Tour";
import { Avatar, cx, useEsc, useNow } from "./ui";
import { Audit } from "./screens/Audit";
import { Drawer } from "./screens/Drawer";
import { Floor } from "./screens/Floor";
import { Hardware } from "./screens/Hardware";
import { Ingredients } from "./screens/Ingredients";
import { Kitchen } from "./screens/Kitchen";
import { Menu } from "./screens/Menu";
import { Orders } from "./screens/Orders";
import { Purchasing } from "./screens/Purchasing";
import { Recipes } from "./screens/Recipes";
import { Reports } from "./screens/Reports";
import { Settings } from "./screens/Settings";
import { SignIn } from "./screens/SignIn";
import { Staff } from "./screens/Staff";
import { Till } from "./screens/Till";
import { Today } from "./screens/Today";

const SERVICE: Module[] = ["today", "till", "floor", "kitchen", "orders", "drawer"];
const OFFICE_GROUPS: Group[] = ["stock", "money", "setup"];

const SCREENS: Record<Module, () => React.JSX.Element> = {
  today: Today, till: Till, floor: Floor, kitchen: Kitchen, orders: Orders, drawer: Drawer,
  menu: Menu, recipes: Recipes, ingredients: Ingredients, purchasing: Purchasing,
  reports: Reports, audit: Audit, staff: Staff, settings: Settings, hardware: Hardware,
};

export function DemoShell() {
  return (
    <StoreProvider>
      <Gate />
    </StoreProvider>
  );
}

function Gate() {
  const { state } = useStore();
  if (!state.user) return <SignIn />;
  return <App />;
}

function App() {
  const { state, api } = useStore();
  const me = currentUser(state)!;
  const [launcher, setLauncher] = useState(false);
  const Screen = SCREENS[state.module];
  const officeModule = !SERVICE.includes(state.module) ? MODULES.find((m) => m.id === state.module) : undefined;
  const kitchenQueue = state.tickets.filter((t) => t.status === "new" || t.status === "cooking").length;
  const openTables = state.tables.filter((t) => t.status === "open").length;

  useEsc(launcher ? () => setLauncher(false) : undefined);
  useEffect(() => { setLauncher(false); }, [state.module]);

  // Keyboard: 1–6 service modules, B back office, Esc handled per overlay.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector(".modal-bg")) return;
      const i = Number.parseInt(e.key, 10);
      if (i >= 1 && i <= 6 && can(me.role, SERVICE[i - 1])) api.go(SERVICE[i - 1]);
      if (e.key.toLowerCase() === "b" && OFFICE_GROUPS.some((g) => MODULES.some((m) => m.group === g && can(me.role, m.id)))) setLauncher((v) => !v);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [api, me.role]);

  const visibleService = SERVICE.filter((m) => can(me.role, m));
  const hasOffice = MODULES.some((m) => OFFICE_GROUPS.includes(m.group) && can(me.role, m.id));

  return (
    <div className="sb">
      <header className="hd">
        <div className="wordmark"><i />Lush View<small>POS</small></div>
        <nav className="nav" aria-label="Modules">
          {visibleService.map((m) => {
            const meta = MODULES.find((x) => x.id === m)!;
            const n = m === "kitchen" ? kitchenQueue : m === "floor" ? openTables : 0;
            return (
              <button key={m} type="button" className={cx("nav-btn", state.module === m && "is-active")} onClick={() => api.go(m)}>
                {meta.label}{n > 0 && <span className="n">{n}</span>}
              </button>
            );
          })}
          {hasOffice && (
            <button type="button" className={cx("nav-btn is-office", (launcher || officeModule) && "is-active")} onClick={() => setLauncher((v) => !v)} aria-expanded={launcher}>
              <LayoutGrid size={16} strokeWidth={2.5} />
              {officeModule ? officeModule.label : "Back office"}
              <ChevronDown size={14} strokeWidth={3} className={cx("transition-transform", launcher && "rotate-180")} />
            </button>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-2.5">
          <span className="chip hidden xl:inline-flex"><i />Online · synced</span>
          <Clock />
          <UserMenu />
        </div>
      </header>
      <div className="band" aria-hidden="true" />
      <main className="min-h-0 min-w-0">
        <Screen />
      </main>

      {launcher && <Launcher onClose={() => setLauncher(false)} />}
      <ToastView />
      {state.tour !== null && <Tour />}
    </div>
  );
}

function Clock() {
  const now = useNow(15000);
  return <span className="chip d hidden md:inline-flex" aria-label="Time">{hm(now)}</span>;
}

function UserMenu() {
  const { state, api } = useStore();
  const me = currentUser(state)!;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex items-center gap-2.5 rounded-[14px] p-0.5 hover:bg-[var(--cream2)]" aria-haspopup="menu" aria-expanded={open}>
        <Avatar initials={me.initials} tone={me.color} />
        <span className="hidden text-left leading-tight lg:block">
          <span className="block text-[13px] font-bold">{me.name.split(" ")[0]}</span>
          <span className="block text-[11px] font-semibold text-[var(--ink3)]">{ROLE_LABEL[me.role]}</span>
        </span>
        <ChevronDown size={14} strokeWidth={3} className="mr-1 text-[var(--ink3)]" />
      </button>
      {open && (
        <div className="menu" role="menu">
          <div className="px-3 py-2">
            <div className="d text-[15px] font-bold">{me.name}</div>
            <div className="text-[12px] font-semibold text-[var(--ink3)]">{ROLE_LABEL[me.role]} · Osu branch · Till 1</div>
          </div>
          <button type="button" className="menu-item" role="menuitem" onClick={() => { setOpen(false); api.setTour(0); }}><span>Take the tour</span><Compass size={16} /></button>
          <button type="button" className="menu-item" role="menuitem" onClick={() => { setOpen(false); api.signOut(); }}><span>Switch user</span><Users size={16} /></button>
          <button type="button" className="menu-item danger" role="menuitem" onClick={() => { if (confirm("Reset the demo to its opening state? Everything you changed will be lost.")) api.reset(); }}><span>Reset demo data</span><RotateCcw size={16} /></button>
          <div className="mx-3 my-1 border-t-2 border-[var(--line)]" />
          <button type="button" className="menu-item" role="menuitem" onClick={() => { setOpen(false); api.signOut(); }}><span>Sign out</span><LogOut size={16} /></button>
        </div>
      )}
    </div>
  );
}

function Launcher({ onClose }: { onClose: () => void }) {
  const { state, api } = useStore();
  const me = currentUser(state)!;
  return (
    <div className="launch" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="mx-auto max-w-[1180px]">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <div className="kicker">Back office</div>
            <h2 className="page-title mt-2">Everything behind the counter.</h2>
          </div>
          <span className="hidden text-[13px] font-semibold text-[var(--ink3)] md:block">Press <kbd className="rounded-md border-2 border-[var(--line2)] px-1.5 py-0.5 text-[11px] font-bold">B</kbd> to open this anywhere · Esc to close</span>
        </div>
        {OFFICE_GROUPS.map((g) => {
          const mods = MODULES.filter((m) => m.group === g);
          return (
            <section key={g} className="mb-7">
              <div className="mb-3 flex items-center gap-3">
                <span className="dot" data-tone={GROUPS[g].tone} />
                <h3 className="d text-[15px] font-bold">{GROUPS[g].label}</h3>
              </div>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
                {mods.map((m) => {
                  const ok = can(me.role, m.id);
                  return (
                    <button key={m.id} type="button" className="launch-tile" data-tone={GROUPS[g].tone} disabled={!ok} onClick={() => api.go(m.id)} title={ok ? m.desc : `${ROLE_LABEL[me.role]} can't open ${m.label}`}>
                      <span className="launch-name">{m.label}</span>
                      <span className="launch-desc">{ok ? m.desc : "Not in your role"}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function ToastView() {
  const { state } = useStore();
  const t = state.toast;
  const [shown, setShown] = useState(t);
  useEffect(() => { if (t) setShown(t); }, [t]);
  return (
    <div className={cx("toast", t && "is-on")} data-tone={shown?.tone ?? "ok"} role="status" aria-live="polite">{shown?.msg}</div>
  );
}
