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
  X,
  Store,
  KeyRound,
  LogOut,
  Maximize,
  Wifi,
  WifiOff,
  ShieldAlert,
  RefreshCw,
} from "lucide-react";
import { UserRole, ROLE_PERMISSIONS } from "@/lib/permissions";
import { useOnlineStatus, useOfflineQueueCount } from "@/lib/use-terminal-status";
import { syncOfflineQueueToServer } from "@/lib/offline-storage";
import { DisplaySizeControl } from "@/components/DisplaySizeControl";
import { PinSwitchModal } from "@/components/PinSwitchModal";
import { notify } from "@/lib/notify";
import type { CurrentUser } from "@/lib/api-types";

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
  /**
   * Phones and small tablets (below md) show this rail as a slide-in drawer
   * over the screen instead of a permanent column — a 264px column is a third
   * of a phone. md and up keep the in-flow rail.
   */
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
  /**
   * Desktop/tablet rail only: the signed-in user and terminal controls that
   * used to live in the top bar (display size, online state, fullscreen,
   * Switch Staff, sign out). They moved here so the bar could come off the
   * top of md+ screens and give that height to the work area — most
   * importantly the POS bill panel's items list. Phones keep the top bar.
   */
  currentUser?: CurrentUser | null;
  lowStockCount?: number;
  onUserChange?: (user: any) => void;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  userRole = "super_admin",
  onNewOrder,
  openTableCount = 0,
  shiftOpen = false,
  isCollapsed = false,
  mobileOpen = false,
  onCloseMobile,
  currentUser = null,
  lowStockCount = 0,
  onUserChange,
  onLogout,
}) => {
  const perms = ROLE_PERMISSIONS[userRole] ?? ROLE_PERMISSIONS.cashier;

  // Till screens are usually 10–13" tablets in landscape: a 264px labelled
  // rail plus the order panel leaves the dish grid too narrow to tap
  // (field report, Oct 2026). Below xl the rail therefore collapses to
  // icons whatever the caller asked for; xl and up honours isCollapsed.
  const [wideScreen, setWideScreen] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(min-width: 80rem)");
    const update = () => setWideScreen(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  const collapsed = isCollapsed || !wideScreen;

  // Terminal controls that moved in from the top bar (md+ only; the phone
  // top bar keeps its own copies). Hooks run unconditionally either way.
  const isOnline = useOnlineStatus();
  const offlineCount = useOfflineQueueCount(currentUser?.branchId ?? 0);
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [showPinModal, setShowPinModal] = React.useState(false);
  const roleLabel = ROLE_PERMISSIONS[userRole]?.label || userRole;

  const handleManualSync = async () => {
    if (!currentUser) return;
    setIsSyncing(true);
    const res = await syncOfflineQueueToServer(currentUser.branchId);
    setIsSyncing(false);
    if (res.success && res.count > 0) {
      notify(`Sent ${res.count} offline order${res.count === 1 ? "" : "s"} to the server. Collect any payments that were taken on paper.`, "ok");
    } else if (!res.success) {
      notify("Could not reach the server — the offline orders are still on this device.", "error");
    } else {
      notify("Nothing waiting to sync.", "ok");
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

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
        { id: "orders", label: "Order History", short: "Orders", icon: Receipt, visible: perms.canViewOrderHistory },
      ],
    },
    {
      title: "CASH DRAWER",
      items: [
        { id: "shifts", label: "Cash Drawer", short: "Cash", icon: Coins, badge: shiftOpen ? "● Open" : "○ Closed", visible: perms.canViewDrawerHistory },
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
        { id: "audit", label: "Audit Logs", short: "Audit", icon: FileText, visible: perms.canViewTransactionTrail },
      ],
    },
    {
      title: "SYSTEM",
      items: [
        { id: "integrations", label: "Hardware & Tenders", short: "Hardware", icon: Cable, visible: perms.canManageSettings },
        { id: "settings", label: "Settings & Branch", short: "Settings", icon: Sliders, visible: perms.canManageSettings },
        { id: "deployment", label: "Hosting Deploy", short: "Deploy", icon: Server, badge: "Ready", visible: perms.canManageSettings },
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
        mobileOpen
          ? "max-md:translate-x-0 max-md:visible"
          : "max-md:-translate-x-full max-md:invisible max-md:pointer-events-none"
      } max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 max-md:w-[280px] max-md:max-w-[85vw] max-md:shadow-2xl ${
        collapsed ? "md:w-[76px]" : "md:w-[264px]"
      }`}
    >
      {/* Drawer header — phones only. The drawer covers the screen, so it needs
          an obvious way back to the till that is not "tap somewhere". */}
      <div className="md:hidden flex items-center justify-between pl-4 pr-2.5 pt-3">
        <span className="text-[0.6875rem] font-bold tracking-[0.12em] text-neutral-500 uppercase">
          Menu
        </span>
        <button
          onClick={onCloseMobile}
          className="h-11 w-11 rounded-xl bg-neutral-800 hover:bg-neutral-750 active:bg-neutral-700 border border-neutral-700 text-neutral-300 flex items-center justify-center transition"
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Brand + register state (md+). This sat in the top bar until the bar
          came off md+ screens; the register state is the one thing a cashier
          must never have to guess, so it lives at the top of the rail. */}
      <div className={`max-md:hidden pt-3.5 pb-1 ${collapsed ? "px-2.5 flex justify-center" : "px-3.5"}`}>
        {collapsed ? (
          <div
            className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/20"
            title={`Lush View Hotel — ${shiftOpen ? "Register Open" : "Register Closed"}`}
          >
            <Store className="w-6 h-6 text-white" />
          </div>
        ) : (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/20 shrink-0">
              <Store className="w-6 h-6 text-white" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-[0.9375rem] tracking-tight text-neutral-100 truncate">
                Lush View Hotel
              </div>
              <div className="flex items-center gap-1.5 text-[0.75rem]">
                <span className={`w-2 h-2 rounded-full shrink-0 ${shiftOpen ? "bg-emerald-400" : "bg-amber-400"}`} />
                {shiftOpen ? (
                  <span className="text-emerald-400 font-medium">Register Open</span>
                ) : (
                  <span className="text-amber-400 font-medium">Register Closed</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Primary action — the single most-used control on a POS terminal.
          Oversized so it can be hit without looking away from the customer. */}
      {showNewOrder && (
        <div className="p-3 pb-1">
          <button
            onClick={() => {
              onNewOrder?.();
              onCloseMobile?.();
            }}
            className={`w-full h-14 rounded-2xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-black font-bold shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2.5 transition active:scale-[0.98] ${
              collapsed ? "px-0" : "px-4"
            }`}
            title="Start a new order"
          >
            <Plus className="w-6 h-6 shrink-0" strokeWidth={3} />
            {!collapsed && <span className="text-[0.9375rem]">New Order</span>}
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
            {!collapsed && (
              <div className="px-3 text-[0.625rem] font-bold tracking-[0.12em] text-neutral-500 uppercase">
                {sec.title}
              </div>
            )}
            {collapsed && sIdx > 0 && <div className="mx-3 border-t border-neutral-800" />}

            {sec.items.map((it) => {
              const Icon = it.icon;
              const isActive = activeTab === it.id;
              return (
                <button
                  key={it.id}
                  onClick={() => {
                    onTabChange(it.id as NavTab);
                    onCloseMobile?.();
                  }}
                  // 52px row height keeps every target comfortably above the
                  // ~44px minimum for reliable finger taps.
                  className={`relative w-full flex items-center gap-3.5 rounded-xl transition-all group ${
                    collapsed ? "h-14 justify-center px-0" : "h-[52px] px-3.5"
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
                  {!collapsed && (
                    <div className="flex-1 flex items-center justify-between text-left min-w-0">
                      <span className="truncate text-[0.84375rem] font-semibold">{it.label}</span>
                      {it.badge !== undefined && it.badge !== "" && (
                        <span
                          className={`ml-2 shrink-0 text-[0.6875rem] px-2 py-0.5 rounded-full font-bold ${
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

      {/* Signed-in user + terminal controls (md+; moved from the top bar so
          the bar could come off and give its height to the work area). */}
      {currentUser && (
        <div className="max-md:hidden border-t border-neutral-800 p-3 space-y-2.5">
          {collapsed ? (
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={() => setShowPinModal(true)}
                className="w-10 h-10 rounded-lg bg-gradient-to-tr from-amber-600 to-orange-500 flex items-center justify-center text-sm font-bold text-white shadow-xs"
                title={`${currentUser.name} · ${roleLabel} — tap to switch staff`}
                aria-label={`Signed in as ${currentUser.name}. Switch staff.`}
              >
                {currentUser.name ? currentUser.name.charAt(0) : "U"}
              </button>
              <DisplaySizeControl />
              <div
                className={`w-11 h-11 rounded-xl border flex items-center justify-center ${
                  isOnline
                    ? "bg-neutral-800/80 border-neutral-700/60 text-emerald-400"
                    : "bg-amber-500/10 border-amber-500/30 text-amber-400"
                }`}
                title={isOnline ? "Online" : "Offline — orders queue on this device"}
              >
                {isOnline ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
              </div>
              {offlineCount > 0 && (
                <button
                  onClick={handleManualSync}
                  disabled={isSyncing}
                  className="w-11 h-11 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center justify-center"
                  title={`Sync ${offlineCount} offline order(s) now`}
                  aria-label={`Sync ${offlineCount} offline orders`}
                >
                  <RefreshCw className={`w-5 h-5 ${isSyncing ? "animate-spin" : ""}`} />
                </button>
              )}
              <button
                onClick={toggleFullscreen}
                className="w-11 h-11 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-xl transition flex items-center justify-center"
                title="Toggle fullscreen terminal mode"
                aria-label="Toggle fullscreen"
              >
                <Maximize className="w-5 h-5" />
              </button>
              <button
                onClick={onLogout}
                className="w-11 h-11 text-rose-400 hover:bg-rose-500/10 rounded-xl transition flex items-center justify-center"
                title="Sign out of terminal"
                aria-label="Sign out of terminal"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2.5 min-w-0 px-0.5">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-amber-600 to-orange-500 flex items-center justify-center text-sm font-bold text-white shadow-xs shrink-0">
                  {currentUser.name ? currentUser.name.charAt(0) : "U"}
                </div>
                <div className="text-left min-w-0">
                  <div className="text-[0.8125rem] font-semibold leading-tight text-neutral-100 truncate">
                    {currentUser.name || "Staff"}
                  </div>
                  <div className="text-[0.65625rem] text-amber-400 font-medium truncate">
                    {roleLabel}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowPinModal(true)}
                  className="flex-1 h-11 px-3 text-neutral-200 hover:text-white hover:bg-neutral-800 rounded-xl border border-neutral-700/60 flex items-center justify-center gap-2 text-[0.75rem] font-semibold transition active:bg-neutral-750"
                  title="Switch employee with PIN"
                >
                  <KeyRound className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Switch Staff</span>
                </button>
                <button
                  onClick={onLogout}
                  className="h-11 w-11 text-rose-400 hover:bg-rose-500/10 rounded-xl border border-neutral-700/60 flex items-center justify-center transition"
                  title="Sign out of terminal"
                  aria-label="Sign out of terminal"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <DisplaySizeControl />
                <div
                  className={`flex items-center gap-1.5 px-2.5 h-11 rounded-xl border text-[0.75rem] ${
                    isOnline
                      ? "bg-neutral-800/80 border-neutral-700/60 text-emerald-400"
                      : "bg-amber-500/10 border-amber-500/30 text-amber-400"
                  }`}
                  title={isOnline ? "Online" : "Offline — orders queue on this device"}
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${isOnline ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
                  {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                  <span className="font-medium">{isOnline ? "Online" : "Offline"}</span>
                  {offlineCount > 0 && (
                    <button
                      onClick={handleManualSync}
                      disabled={isSyncing}
                      className="ml-0.5 px-2 h-7 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 rounded-lg text-[0.6875rem] font-bold flex items-center gap-1 transition"
                      title="Sync offline queue"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                      <span>{offlineCount}</span>
                    </button>
                  )}
                </div>
                <button
                  onClick={toggleFullscreen}
                  className="h-11 w-11 shrink-0 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-xl border border-neutral-700/60 transition flex items-center justify-center"
                  title="Toggle fullscreen terminal mode"
                  aria-label="Toggle fullscreen"
                >
                  <Maximize className="w-5 h-5" />
                </button>
              </div>

              {lowStockCount > 0 && (
                <div className="flex items-center gap-1.5 px-3 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[0.75rem] font-semibold">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{lowStockCount} low stock</span>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Footer Info */}
      {!collapsed ? (
        <div className="p-3.5 border-t border-neutral-800 bg-neutral-950/60 space-y-1">
          <div className="flex items-center justify-between text-[0.6875rem]">
            <span className="font-medium text-neutral-400">Lush View POS</span>
            <span className="text-emerald-400 font-semibold">GH₵ · GHS</span>
          </div>
          <div className="text-[0.625rem] text-neutral-600">v2.5.0 · Touch Terminal Build</div>
        </div>
      ) : (
        <div className="py-3 border-t border-neutral-800 bg-neutral-950/60 flex justify-center">
          <span className="text-[0.625rem] font-bold text-neutral-600">v2.5</span>
        </div>
      )}

      <PinSwitchModal
        open={showPinModal}
        onClose={() => setShowPinModal(false)}
        onUserChange={(user) => {
          onUserChange?.(user);
          onCloseMobile?.();
        }}
      />
    </aside>
  );
};
