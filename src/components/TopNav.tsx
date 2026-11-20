"use client";

import Image from "next/image";
import React, { useState } from "react";
import {
  ChevronDown,
  MoreHorizontal,
  Plus,
  ShieldAlert,
  Wifi,
  WifiOff,
} from "lucide-react";
import { ROLE_PERMISSIONS, type RolePermissionSet, type UserRole } from "@/lib/permissions";
import { buildNavSections, type NavTab } from "@/components/nav-config";
import { AccountMenu, menuItemClass, useDismiss } from "@/components/AccountMenu";
import { useOnlineStatus } from "@/lib/use-terminal-status";
import type { CurrentUser } from "@/lib/api-types";

/** Screens that sit directly on the bar; everything else lives under More. */
const PRIMARY: NavTab[] = ["pos", "tables", "kds", "orders", "shifts"];

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
  const moreRef = useDismiss(moreOpen, setMoreOpen);
  const isOnline = useOnlineStatus();

  const go = (id: NavTab) => {
    setMoreOpen(false);
    onTabChange(id);
  };
  const tabClass = (on: boolean) =>
    `h-11 px-3 rounded-lg flex items-center gap-2 text-sm font-semibold whitespace-nowrap transition ${
      on ? "bg-ui-primary-soft text-ui-primary-text" : "text-ui-text-2 hover:bg-ui-subtle hover:text-ui-text"
    }`;
  const menuItem = menuItemClass;

  return (
    <header className="@container max-md:hidden shrink-0 h-16 bg-ui-surface border-b border-ui-border flex items-center gap-3 px-4 text-ui-text select-none">
      <div className="flex items-center gap-2 shrink-0">
        {/* The hotel's own mark (public/logo.svg, also the app icon) rather
            than initials in a box (stage 7). */}
        <Image unoptimized src="/logo.svg" alt="" width={40} height={40} className="w-10 h-10 rounded-xl shadow-ui-1" priority />
        <span className="hidden @[96rem]:flex flex-col leading-tight">
          <span className="text-base font-extrabold tracking-tight">Lush View</span>
          <span className="text-[0.6875rem] font-semibold text-ui-muted">Restaurant &amp; bar</span>
        </span>
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

      <AccountMenu currentUser={currentUser} onUserChange={onUserChange} onLogout={onLogout} showName />
    </header>
  );
}
