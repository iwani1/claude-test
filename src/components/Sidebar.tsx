"use client";

import React from "react";
import {
  LayoutDashboard,
  Calculator,
  Grid,
  ChefHat,
  Receipt,
  UtensilsCrossed,
  Scroll,
  Boxes,
  Truck,
  Coins,
  BarChart3,
  Users2,
  FileText,
  Sliders,
  Server,
  Cable,
  Plus,
} from "lucide-react";
import { UserRole, ROLE_PERMISSIONS } from "@/lib/permissions";

export type NavTab =
  | "dashboard"
  | "pos"
  | "tables"
  | "kds"
  | "orders"
  | "menu"
  | "recipes"
  | "inventory"
  | "purchasing"
  | "shifts"
  | "reports"
  | "staff"
  | "audit"
  | "integrations"
  | "settings"
  | "deployment";

interface SidebarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  userRole?: UserRole;
  /** Fired by the prominent "New Order" action at the top of the rail. */
  onNewOrder?: () => void;
  /** Count of open tables, surfaced as a glanceable badge. */
  openTableCount?: number;
  /** Whether a cash shift is currently open (drives the Drawer badge). */
  shiftOpen?: boolean;
  isCollapsed?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  userRole = "super_admin",
  onNewOrder,
  openTableCount = 0,
  shiftOpen = false,
  isCollapsed = false,
}) => {
  const perms = ROLE_PERMISSIONS[userRole] ?? ROLE_PERMISSIONS.cashier;

  // Each entry declares the permission gate it sits behind. Modules the
  // signed-in role cannot use are removed from navigation entirely, and the
  // matching API routes are independently guarded server-side.
  const allSections: {
    title: string;
    items: {
      id: NavTab;
      label: string;
      icon: typeof Calculator;
      badge?: string | number;
      visible: boolean;
      /** Shortened label used when the rail is collapsed to icons only. */
      short?: string;
    }[];
  }[] = [
    {
      title: "TAKE ORDERS",
      items: [
        { id: "pos", label: "Take Order (Till)", short: "Order", icon: Calculator, visible: perms.canAccessPos },
        { id: "tables", label: "Tables", short: "Tables", icon: Grid, badge: openTableCount > 0 ? `${openTableCount} open` : undefined, visible: perms.canAccessPos },
        { id: "kds", label: "Kitchen", short: "Kitchen", icon: ChefHat, visible: perms.canAccessKds },
        { id: "orders", label: "Order History", short: "Orders", icon: Receipt, visible: perms.canAccessPos || perms.canViewReports },
      ],
    },
    {
      title: "CASH DRAWER",
      items: [
        { id: "shifts", label: "Cash Drawer", short: "Cash", icon: Coins, badge: shiftOpen ? "● Open" : "○ Closed", visible: perms.canAccessPos || perms.canViewReports },
      ],
    },
    {
      title: "MENU & STOCK",
      items: [
        { id: "menu", label: "Menu Items", short: "Menu", icon: UtensilsCrossed, visible: perms.canManageMenu },
        { id: "recipes", label: "Recipes & Costing", short: "Recipes", icon: Scroll, visible: perms.canManageMenu },
        { id: "inventory", label: "Ingredient Stock", short: "Stock", icon: Boxes, visible: perms.canModifyInventory },
        { id: "purchasing", label: "Purchasing & GRN", short: "Buying", icon: Truck, visible: perms.canModifyInventory },
      ],
    },
    {
      title: "MANAGEMENT",
      items: [
        { id: "dashboard", label: "Owner Dashboard", short: "Dashboard", icon: LayoutDashboard, visible: perms.canViewReports },
        { id: "reports", label: "Reports & Analytics", short: "Reports", icon: BarChart3, visible: perms.canViewReports },
        { id: "staff", label: "Staff & Permissions", short: "Staff", icon: Users2, visible: perms.canManageStaff },
        { id: "audit", label: "Audit Logs", short: "Audit", icon: FileText, visible: perms.canViewReports },
      ],
    },
    {
      title: "SYSTEM",
      items: [
        { id: "integrations", label: "Hardware & Tenders", short: "Hardware", icon: Cable, visible: perms.canManageSettings },
        { id: "settings", label: "Settings & Branch", short: "Settings", icon: Sliders, visible: perms.canManageSettings },
        { id: "deployment", label: "GreenGeeks Deploy", short: "Deploy", icon: Server, badge: "Ready", visible: perms.canManageSettings },
      ],
    },
  ];

  const navSections = allSections
    .map((s) => ({ ...s, items: s.items.filter((i) => i.visible) }))
    .filter((s) => s.items.length > 0);

  const showNewOrder = perms.canAccessPos && !!onNewOrder;

  return (
    <aside
      className={`bg-neutral-900 border-r border-neutral-800 text-neutral-300 flex flex-col shrink-0 select-none transition-all duration-200 ${
        isCollapsed ? "w-[76px]" : "w-[264px]"
      }`}
    >
      {/* Primary action — the single most-used control on a POS terminal.
          Oversized so it can be hit without looking away from the customer. */}
      {showNewOrder && (
        <div className="p-3 pb-1">
          <button
            onClick={onNewOrder}
            className={`w-full h-14 rounded-2xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-black font-bold shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2.5 transition active:scale-[0.98] ${
              isCollapsed ? "px-0" : "px-4"
            }`}
            title="Start a new order"
          >
            <Plus className="w-6 h-6 shrink-0" strokeWidth={3} />
            {!isCollapsed && <span className="text-[15px]">New Order</span>}
          </button>
        </div>
      )}

      <nav
        className={`flex-1 overflow-y-auto custom-scrollbar ${
          showNewOrder ? "pt-2 pb-3 px-2.5" : "py-4 px-2.5"
        } space-y-4`}
      >
        {navSections.map((sec, sIdx) => (
          <div key={sIdx} className="space-y-1.5">
            {!isCollapsed && (
              <div className="px-3 text-[10px] font-bold tracking-[0.12em] text-neutral-500 uppercase">
                {sec.title}
              </div>
            )}
            {isCollapsed && sIdx > 0 && <div className="mx-3 border-t border-neutral-800" />}

            {sec.items.map((it) => {
              const Icon = it.icon;
              const isActive = activeTab === it.id;
              return (
                <button
                  key={it.id}
                  onClick={() => onTabChange(it.id as NavTab)}
                  // 52px row height keeps every target comfortably above the
                  // ~44px minimum for reliable finger taps.
                  className={`relative w-full flex items-center gap-3.5 rounded-xl transition-all group ${
                    isCollapsed ? "h-14 justify-center px-0" : "h-[52px] px-3.5"
                  } ${
                    isActive
                      ? "bg-amber-500 text-black font-bold shadow-lg shadow-amber-500/20"
                      : "text-neutral-300 hover:bg-neutral-800 hover:text-white active:bg-neutral-750"
                  }`}
                  title={it.label}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon
                    className={`w-[22px] h-[22px] shrink-0 transition ${
                      isActive ? "text-black" : "text-neutral-400 group-hover:text-amber-400"
                    }`}
                  />
                  {!isCollapsed && (
                    <div className="flex-1 flex items-center justify-between text-left min-w-0">
                      <span className="truncate text-[13.5px] font-semibold">{it.label}</span>
                      {it.badge !== undefined && it.badge !== "" && (
                        <span
                          className={`ml-2 shrink-0 text-[11px] px-2 py-0.5 rounded-full font-bold ${
                            isActive
                              ? "bg-black/20 text-black"
                              : "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                          }`}
                        >
                          {it.badge}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Active indicator edge for quick peripheral scanning */}
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 -ml-2.5 h-8 w-1.5 rounded-r-full bg-amber-400" />
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer Info */}
      {!isCollapsed ? (
        <div className="p-3.5 border-t border-neutral-800 bg-neutral-950/60 space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-medium text-neutral-400">Asanka Royal POS</span>
            <span className="text-emerald-400 font-semibold">GH₵ · 15% VAT</span>
          </div>
          <div className="text-[10px] text-neutral-600">v2.5.0 · Touch Terminal Build</div>
        </div>
      ) : (
        <div className="py-3 border-t border-neutral-800 bg-neutral-950/60 flex justify-center">
          <span className="text-[10px] font-bold text-neutral-600">v2.5</span>
        </div>
      )}
    </aside>
  );
};
