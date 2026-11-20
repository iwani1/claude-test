"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  KeyRound,
  LogOut,
  Maximize,
  Moon,
  MoreHorizontal,
  Plus,
  ShieldAlert,
  Sun,
  Type,
  Undo2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { ROLE_PERMISSIONS, type RolePermissionSet, type UserRole } from "@/lib/permissions";
import { buildNavSections, type NavTab } from "@/components/nav-config";
import { PinSwitchModal } from "@/components/PinSwitchModal";
import {
  DISPLAY_SIZE_LABEL,
  applyDisplaySize,
  readDisplaySize,
  type DisplaySize,
} from "@/components/DisplaySizeControl";
import { useOnlineStatus } from "@/lib/use-terminal-status";
import { setUiDesign, setUiTheme, useUiPreferences } from "@/lib/ui-preferences";
import type { CurrentUser } from "@/lib/api-types";

/** Screens that sit directly on the bar; everything else lives under More. */
const PRIMARY: NavTab[] = ["pos", "tables", "kds", "orders", "shifts"];
const DISPLAY_SIZES: DisplaySize[] = ["standard", "large", "extra"];

/** Closes a popover on an outside tap or Escape. */
function useDismiss(open: boolean, setOpen: (open: boolean) => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, setOpen]);
  return ref;
}

/**
 * The new design's shell bar (md and up): screens as tabs across the top,
 * the Dreams-style layout chosen in Nov 2026. It replaces the classic
 * sidebar and controls strip only while this terminal has the new design
 * switched on; it uses the same screen list and permission gates
 * (nav-config.ts), so nothing becomes visible that the sidebar would hide.
 */
export function TopNav({
  activeTab,
  onTabChange,
  onNewOrder,
  currentUser,
  userPermissions,
  openTableCount = 0,
  shiftOpen = false,
  lowStockCount = 0,
  onUserChange,
  onLogout,
}: {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onNewOrder?: () => void;
  currentUser: CurrentUser;
  userPermissions?: RolePermissionSet;
  openTableCount?: number;
  shiftOpen?: boolean;
  lowStockCount?: number;
  onUserChange: (user: any) => void;
  onLogout?: () => void;
}) {
  const perms = userPermissions ?? ROLE_PERMISSIONS[currentUser.role as UserRole] ?? ROLE_PERMISSIONS.cashier;
  const sections = buildNavSections(perms, { openTableCount, shiftOpen });
  const all = sections.flatMap((s) => s.items);
  const primary = PRIMARY.map((id) => all.find((i) => i.id === id)).filter(Boolean) as typeof all;
  const moreSections = sections
    .map((s) => ({ ...s, items: s.items.filter((i) => !PRIMARY.includes(i.id)) }))
    .filter((s) => s.items.length > 0);
  const activeInMore = moreSections.some((s) => s.items.some((i) => i.id === activeTab));

  const [moreOpen, setMoreOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [size, setSize] = useState<DisplaySize>("large");
  const moreRef = useDismiss(moreOpen, setMoreOpen);
  const userRef = useDismiss(userOpen, setUserOpen);
  const { theme } = useUiPreferences();
  const isOnline = useOnlineStatus();
  const roleLabel = ROLE_PERMISSIONS[currentUser.role as UserRole]?.label || currentUser.role;
  const initials = (currentUser.name || "Staff")
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  useEffect(() => {
    // Read after mount: the pre-paint script already applied the size.
    const t = setTimeout(() => setSize(readDisplaySize()), 0);
    return () => clearTimeout(t);
  }, []);

  const go = (id: NavTab) => {
    setMoreOpen(false);
    onTabChange(id);
  };
  const cycleSize = () => {
    const next = DISPLAY_SIZES[(DISPLAY_SIZES.indexOf(size) + 1) % DISPLAY_SIZES.length];
    setSize(next);
    applyDisplaySize(next);
  };
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  };

  const tabClass = (on: boolean) =>
    `h-11 px-3 rounded-lg flex items-center gap-2 text-sm font-semibold whitespace-nowrap transition ${
      on ? "bg-ui-primary-soft text-ui-primary-text" : "text-ui-text-2 hover:bg-ui-subtle hover:text-ui-text"
    }`;
  const menuItem =
    "w-full min-h-11 px-3 rounded-lg flex items-center gap-2.5 text-left text-sm font-semibold text-ui-text hover:bg-ui-subtle transition";

  return (
    <header className="@container max-md:hidden shrink-0 h-16 bg-ui-surface border-b border-ui-border flex items-center gap-3 px-4 text-ui-text select-none">
      <div className="flex items-center gap-2 shrink-0">
        <span aria-hidden="true" className="w-9 h-9 rounded-lg bg-ui-primary text-ui-on-primary text-sm font-bold flex items-center justify-center">
          LV
        </span>
        <span className="hidden @[96rem]:inline text-base font-bold">Lush View</span>
      </div>

      {/* Labels drop by container width in rem, not by screen breakpoints:
          everything in the bar grows with the terminal's text size (18px root
          by default) and container rem grows with it, while screen
          breakpoints do not. So the name, wordmark and "Online" go first and
          the tab labels last, whatever size the terminal is set to. */}
      <nav aria-label="Screens" className="flex items-center gap-1 min-w-0">
        {primary.map((it) => {
          const Icon = it.icon;
          return (
            <button
              key={it.id}
              type="button"
              onClick={() => go(it.id)}
              aria-current={activeTab === it.id ? "page" : undefined}
              aria-label={it.label}
              className={tabClass(activeTab === it.id)}
            >
              <Icon className="w-[1.125rem] h-[1.125rem] shrink-0" />
              <span className="hidden @[60rem]:inline">{it.short ?? it.label}</span>
              {it.id === "tables" && openTableCount > 0 && (
                <span className="min-w-5 h-5 px-1 rounded-full bg-ui-primary text-ui-on-primary text-[0.6875rem] font-bold flex items-center justify-center">
                  {openTableCount}
                </span>
              )}
            </button>
          );
        })}
        {moreSections.length > 0 && (
          <div ref={moreRef} className="relative">
            <button
              type="button"
              onClick={() => setMoreOpen((o) => !o)}
              aria-expanded={moreOpen}
              aria-haspopup="menu"
              aria-label="More screens"
              className={tabClass(activeInMore || moreOpen)}
            >
              <MoreHorizontal className="w-[1.125rem] h-[1.125rem]" />
              <span className="hidden @[60rem]:inline">More</span>
              <ChevronDown className="w-4 h-4" />
            </button>
            {moreOpen && (
              <div
                role="menu"
                className="absolute left-0 top-full mt-2 z-50 w-72 max-h-[70dvh] overflow-y-auto rounded-xl border border-ui-border bg-ui-surface shadow-xl p-2"
              >
                {moreSections.map((sec) => (
                  <div key={sec.title} className="py-1">
                    <div className="px-3 pt-1 pb-1.5 text-[0.6875rem] font-bold tracking-[0.08em] text-ui-muted">{sec.title}</div>
                    {sec.items.map((it) => {
                      const Icon = it.icon;
                      return (
                        <button
                          key={it.id}
                          type="button"
                          role="menuitem"
                          onClick={() => go(it.id)}
                          className={`${menuItem} ${activeTab === it.id ? "bg-ui-primary-soft text-ui-primary-text" : ""}`}
                        >
                          <Icon className="w-[1.125rem] h-[1.125rem] shrink-0" />
                          {it.label}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </nav>

      <div className="flex-1" />

      {perms.canAccessPos && onNewOrder && (
        <button
          type="button"
          onClick={onNewOrder}
          aria-label="New order"
          className="h-11 px-4 rounded-lg bg-ui-primary hover:bg-ui-primary-hover text-ui-on-primary text-sm font-bold flex items-center gap-1.5 shrink-0 transition active:scale-[0.98]"
        >
          <Plus className="w-[1.125rem] h-[1.125rem]" strokeWidth={2.6} />
          <span className="hidden @[48rem]:inline">New order</span>
        </button>
      )}

      {lowStockCount > 0 && (
        <button
          type="button"
          onClick={() => perms.canModifyInventory && go("inventory")}
          className="hidden @[80rem]:flex h-11 px-3 rounded-lg items-center gap-1.5 bg-ui-danger-soft text-ui-danger text-sm font-semibold shrink-0"
          title="Ingredients at or below their reorder level"
        >
          <ShieldAlert className="w-4 h-4" />
          {lowStockCount} low stock
        </button>
      )}

      <span
        role="status"
        className={`h-11 px-3 rounded-lg flex items-center gap-1.5 text-sm font-semibold shrink-0 ${
          isOnline ? "text-ui-success" : "bg-ui-primary-soft text-ui-primary-text"
        }`}
        title={isOnline ? "Online" : "Offline — orders queue on this device"}
      >
        {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
        <span className="hidden @[100rem]:inline">{isOnline ? "Online" : "Offline"}</span>
      </span>

      <div ref={userRef} className="relative shrink-0">
        <button
          type="button"
          onClick={() => setUserOpen((o) => !o)}
          aria-expanded={userOpen}
          aria-haspopup="menu"
          aria-label={`${currentUser.name}, ${roleLabel}: account menu`}
          className="h-11 pl-1 pr-2 rounded-lg flex items-center gap-2 hover:bg-ui-subtle transition"
        >
          <span className="w-9 h-9 rounded-full bg-ui-primary-soft text-ui-primary-text text-[0.8125rem] font-bold flex items-center justify-center">
            {initials}
          </span>
          <span className="hidden @[88rem]:flex flex-col items-start leading-tight">
            <span className="text-[0.8125rem] font-bold max-w-36 truncate">{currentUser.name}</span>
            <span className="text-xs text-ui-muted">{roleLabel}</span>
          </span>
          <ChevronDown className="w-4 h-4 text-ui-muted" />
        </button>
        {userOpen && (
          <div role="menu" className="absolute right-0 top-full mt-2 z-50 w-72 rounded-xl border border-ui-border bg-ui-surface shadow-xl p-2">
            <div className="px-3 py-2 border-b border-ui-border mb-1">
              <div className="text-sm font-bold">{currentUser.name}</div>
              <div className="text-xs text-ui-muted">{roleLabel}</div>
            </div>
            <button type="button" role="menuitem" className={menuItem} onClick={() => { setUserOpen(false); setPinOpen(true); }}>
              <KeyRound className="w-[1.125rem] h-[1.125rem] text-ui-muted" /> Switch staff
            </button>
            <button type="button" role="menuitem" className={menuItem} onClick={cycleSize}>
              <Type className="w-[1.125rem] h-[1.125rem] text-ui-muted" />
              <span className="flex-1">Text &amp; touch size</span>
              <span className="text-xs text-ui-muted">{DISPLAY_SIZE_LABEL[size]}</span>
            </button>
            <div className="px-3 pt-2 pb-1 text-[0.6875rem] font-bold tracking-[0.08em] text-ui-muted">THEME</div>
            <div role="group" aria-label="Theme" className="grid grid-cols-2 gap-1 px-1 pb-1">
              {([
                ["light", "Light", Sun],
                ["dark", "Dark", Moon],
              ] as const).map(([value, label, Icon]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={theme === value}
                  onClick={() => setUiTheme(value)}
                  className={`h-11 rounded-lg flex items-center justify-center gap-2 text-sm font-semibold border transition ${
                    theme === value
                      ? "border-ui-primary bg-ui-primary-soft text-ui-primary-text"
                      : "border-ui-border text-ui-text-2 hover:bg-ui-subtle"
                  }`}
                >
                  <Icon className="w-4 h-4" /> {label}
                </button>
              ))}
            </div>
            <button type="button" role="menuitem" className={menuItem} onClick={toggleFullscreen}>
              <Maximize className="w-[1.125rem] h-[1.125rem] text-ui-muted" /> Full screen
            </button>
            <button type="button" role="menuitem" className={menuItem} onClick={() => setUiDesign("classic")}>
              <Undo2 className="w-[1.125rem] h-[1.125rem] text-ui-muted" /> Back to the classic design
            </button>
            <div className="border-t border-ui-border mt-1 pt-1">
              <button type="button" role="menuitem" className={`${menuItem} text-ui-danger`} onClick={onLogout}>
                <LogOut className="w-[1.125rem] h-[1.125rem]" /> Sign out
              </button>
            </div>
          </div>
        )}
      </div>

      <PinSwitchModal open={pinOpen} onClose={() => setPinOpen(false)} onUserChange={onUserChange} />
    </header>
  );
}
