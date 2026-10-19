"use client";

import React from "react";
import { Calculator, Grid, ChefHat, Receipt, Coins } from "lucide-react";
import { ROLE_PERMISSIONS, UserRole, type RolePermissionSet } from "@/lib/permissions";
import type { NavTab } from "@/components/Sidebar";

interface MobileTabBarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  userRole?: UserRole;
  /** Effective permissions for the signed-in person (role + owner selections). */
  userPermissions?: RolePermissionSet;
  /** Glanceable badge: tables that currently have an order on them. */
  openTableCount?: number;
  /** Glanceable state: is the cash drawer open (green) or closed (amber)? */
  shiftOpen?: boolean;
}

/**
 * Phone/tablet-portrait navigation. The five screens a shift actually lives in
 * sit within thumb reach at the bottom of the screen, so nobody has to open the
 * drawer to move between the till, the floor plan and the kitchen. Everything
 * else stays in the drawer behind the Menu button.
 *
 * Hidden from md up, where the permanent rail already does this job.
 */
export const MobileTabBar: React.FC<MobileTabBarProps> = ({
  activeTab,
  onTabChange,
  userRole,
  userPermissions,
  openTableCount = 0,
  shiftOpen = false,
}) => {
  // No role known yet: show nothing rather than guessing at permissions.
  const perms = userPermissions ?? (userRole ? ROLE_PERMISSIONS[userRole] : undefined);

  const tabs: {
    id: NavTab;
    label: string;
    icon: typeof Calculator;
    visible: boolean;
    badge?: string;
    tone?: "ok" | "warn";
  }[] = [
    { id: "pos", label: "Till", icon: Calculator, visible: !!perms?.canAccessPos },
    {
      id: "tables",
      label: "Tables",
      icon: Grid,
      visible: !!perms?.canAccessPos,
      badge: openTableCount > 0 ? String(openTableCount) : undefined,
    },
    { id: "kds", label: "Kitchen", icon: ChefHat, visible: !!perms?.canAccessKds },
    { id: "orders", label: "Orders", icon: Receipt, visible: !!perms?.canViewOrderHistory },
    {
      id: "shifts",
      label: "Drawer",
      icon: Coins,
      visible: !!perms?.canViewDrawerHistory,
      badge: shiftOpen ? "Open" : "Shut",
      tone: shiftOpen ? "ok" : "warn",
    },
  ];

  const visibleTabs = tabs.filter((t) => t.visible);
  if (visibleTabs.length === 0) return null;

  return (
    <nav
      /* Exactly 4rem of controls plus the device's home-indicator strip, which
         is the offset the till's cart bar and the notices use to sit above it. */
      className="md:hidden shrink-0 h-[calc(4rem+env(safe-area-inset-bottom,0px))] pb-safe bg-neutral-900/95 backdrop-blur border-t border-neutral-800 flex items-stretch z-20"
      aria-label="Main screens"
    >
      {visibleTabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            aria-current={isActive ? "page" : undefined}
            className={`relative flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 transition ${
              isActive ? "text-amber-400" : "text-neutral-400 active:text-white"
            }`}
          >
            {/* Active marker stays at the top edge, away from the thumb, so it
                never hides under the finger that just tapped it. */}
            {isActive && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 h-1 w-10 rounded-b-full bg-amber-400" />
            )}
            <span className="relative">
              <Icon className="w-6 h-6" strokeWidth={isActive ? 2.6 : 2} />
              {tab.badge !== undefined && (
                <span
                  className={`absolute -top-1.5 -right-2.5 min-w-5 h-5 px-1 rounded-full text-[0.625rem] font-bold flex items-center justify-center ${
                    tab.tone === "warn"
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                      : tab.tone === "ok"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      : "bg-rose-500 text-white"
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </span>
            <span className={`text-[0.6875rem] leading-none ${isActive ? "font-bold" : "font-semibold"}`}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
