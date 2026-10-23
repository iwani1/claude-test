"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Loader2, Store, ShieldAlert } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Sidebar, NavTab } from "@/components/Sidebar";
import { TerminalControls } from "@/components/TerminalControls";
import { MobileTabBar } from "@/components/MobileTabBar";
import { LoginScreen } from "@/components/LoginScreen";
import { PosTerminal } from "@/components/PosTerminal";
import { TableFloorPlan } from "@/components/TableFloorPlan";
import { KitchenDisplaySystem } from "@/components/KitchenDisplaySystem";
import { InventoryManager } from "@/components/InventoryManager";
import { RecipeManager } from "@/components/RecipeManager";
import { PurchasingManager } from "@/components/PurchasingManager";
import { ShiftCashDrawer } from "@/components/ShiftCashDrawer";
import { OrdersHistory } from "@/components/OrdersHistory";
import { ReportsDashboard } from "@/components/ReportsDashboard";
import { StaffManager } from "@/components/StaffManager";
import { AuditLogsViewer } from "@/components/AuditLogsViewer";
import { IntegrationsManager } from "@/components/IntegrationsManager";
import { RestaurantSettings } from "@/components/RestaurantSettings";
import { DeploymentHub } from "@/components/DeploymentHub";
import { OwnerDashboard } from "@/components/OwnerDashboard";
import { MenuManager } from "@/components/MenuManager";
import {
  saveMenuToCache,
  getCachedMenu,
  saveTablesToCache,
  getCachedTables,
  saveShiftToCache,
  getCachedShift,
  saveIdentity,
  readIdentity,
  clearIdentity,
  getOfflineQueue,
} from "@/lib/offline-storage";
import { useOnlineStatus } from "@/lib/use-terminal-status";
import { Toaster } from "@/components/Toaster";
import { notify } from "@/lib/notify";
import { ROLE_PERMISSIONS, UserRole } from "@/lib/permissions";
import type { CurrentUser, DiningAreaRow, DiningTableRow, MenuCategoryRow, MenuItemRow, ShiftRow } from "@/lib/api-types";
import { readTicketDraft, clearTicketDraft } from "@/lib/active-ticket";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { apiFetch } from "@/lib/api-client";

/** Landing tab per role so each user starts on a screen they can actually use. */
const DEFAULT_TAB: Record<UserRole, NavTab> = {
  super_admin: "dashboard",
  manager: "dashboard",
  cashier: "pos",
  cook: "kds",
  inventory_officer: "inventory",
  accountant: "reports",
};

export default function App() {
  const [authState, setAuthState] = useState<"checking" | "out" | "in">("checking");
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [activeTab, setActiveTab] = useState<NavTab>("pos");
  /**
   * True when the shell is running from this device's last sign-in because the
   * server could not be reached. Nothing is pretended: the banner says so, and
   * every action that needs the server still fails loudly.
   */
  const [offlineSession, setOfflineSession] = useState(false);

  const [categories, setCategories] = useState<MenuCategoryRow[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItemRow[]>([]);
  const [areas, setAreas] = useState<DiningAreaRow[]>([]);
  const [tables, setTables] = useState<DiningTableRow[]>([]);
  const [openShift, setOpenShift] = useState<ShiftRow | null>(null);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [activeTableId, setActiveTableId] = useState<number | null>(null);
  // Bumped every time "New Order" is tapped so the till clears its ticket.
  const [posResetKey, setPosResetKey] = useState(0);
  /** An open order (from Tables or Order History) to reopen on the till. */
  const [posLoadOrderId, setPosLoadOrderId] = useState<number | null>(null);

  const currentBranchId = currentUser?.branchId;

  /** Loads all operational data the shell needs. Falls back to the cached
   *  menu snapshot when the network is unavailable (offline PWA mode). */
  const fetchOperationalData = useCallback(() => {
    if (!currentBranchId) return Promise.resolve();
    return Promise.all(["menu", "tables", "shifts", "inventory"].map(path =>
      fetch(`/api/${path}`).then(async res => {
        // A role may use the shell without permission to access every widget.
        if (res.status === 403) return {};
        if (!res.ok) throw new Error("Operational data unavailable");
        return res.json();
      })
    )).then(([menuData, tablesData, shiftsData, invData]) => {
      if (menuData.categories && menuData.items) {
        setCategories(menuData.categories); setMenuItems(menuData.items);
        saveMenuToCache(menuData, currentBranchId);
      }
      const areas = tablesData.areas || [];
      const tables = tablesData.tables || [];
      setAreas(areas); setTables(tables);
      setOpenShift(shiftsData.activeShift || null);
      setLowStockCount(invData.lowStockCount || 0);
      // Remembered from the server's own answers so a lost signal cannot empty
      // the till: the floor plan, the room charge and the drawer state survive.
      saveTablesToCache(areas, tables, currentBranchId);
      saveShiftToCache(shiftsData.activeShift || null, currentBranchId);
    }).catch(() => {
      // Offline, or the server is down: work from the last known context.
      const cachedMenu = getCachedMenu(currentBranchId);
      if (cachedMenu) { setCategories(cachedMenu.categories || []); setMenuItems(cachedMenu.items || []); }
      const cachedTables = getCachedTables(currentBranchId);
      if (cachedTables) { setAreas(cachedTables.areas || []); setTables(cachedTables.tables || []); }
      const cachedShift = getCachedShift(currentBranchId);
      if (cachedShift) setOpenShift(cachedShift.activeShift ?? null);
    });
  }, [currentBranchId]);

  /** Verify the signed session cookie on mount. */
  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetch("/api/auth/me");
        if (data.authenticated && data.user) {
          setCurrentUser(data.user);
          setActiveTab(DEFAULT_TAB[data.user.role as UserRole] ?? "pos");
          setAuthState("in");
          saveIdentity(data.user);
          setOfflineSession(false);
        } else {
          clearIdentity();
          setAuthState("out");
        }
      } catch {
        // The request never reached the server — that is the offline case, not
        // a rejected session. A device that signed in within the last 12h gets
        // its till back; anything else must connect, because we will not invent
        // a user or a permission set.
        const remembered = readIdentity();
        if (remembered) {
          setCurrentUser(remembered.user);
          setActiveTab(DEFAULT_TAB[remembered.user.role as UserRole] ?? "pos");
          setOfflineSession(true);
          setAuthState("in");
        } else {
          setAuthState("out");
        }
      }
    })();
  }, []);

  // Load operational data only once authenticated.
  useEffect(() => {
    if (authState === "in") fetchOperationalData();
  }, [authState, fetchOperationalData]);

  const handleAuthenticated = (user: any) => {
    saveIdentity(user);
    setCurrentUser(user);
    setActiveTab(DEFAULT_TAB[user.role as UserRole] ?? "pos");
    setAuthState("in");
  };

  /** Switching users via PIN re-points the landing tab to the new role. */
  const handleUserChange = (user: any) => {
    saveIdentity(user);
    setCurrentUser(user);
    setActiveTab(DEFAULT_TAB[user.role as UserRole] ?? "pos");
  };


  /** Switching screens always drops any table context from the till. */
  const handleTabChange = useCallback((tab: NavTab) => {
    setActiveTab(tab);
    if (tab !== "pos") setActiveTableId(null);
  }, []);

  const handleLogout = async () => {
    let serverSignedOut = false;
    try {
      const res = await fetch("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      serverSignedOut = res.ok;
    } catch {
      /* audit-ok: the notice right after this block tells the user the sign-out could not be completed */
      serverSignedOut = false;
    }
    if (!serverSignedOut) {
      // The screen is cleared either way, but the session cookie could not be
      // ended: on a shared terminal that matters, so it is never silent.
      notify(
        "Signed out on this screen, but the server could not be reached to end the session. Sign out again once there is a connection.",
        "error"
      );
    }
    setCategories([]); setMenuItems([]); setAreas([]); setTables([]); setOpenShift(null);
    clearIdentity();
    setOfflineSession(false);
    setCurrentUser(null);
    setAuthState("out");
  };

  const handleOpenPosForTable = (tableId: number) => {
    setActiveTableId(tableId);
    // An occupied table reopens its kitchen order on the bill panel, so
    // staff add to that bill and settle it instead of starting a rival one.
    const table = tables.find((t: any) => t.id === tableId);
    setPosLoadOrderId((table as any)?.activeOrder?.id ?? null);
    setPosResetKey((k) => k + 1);
    setActiveTab("pos");
  };

  /** Reopens an open order from Order History on the bill panel. */
  const handleOpenOrderInPos = (order: any) => {
    setActiveTableId(order.tableId ?? null);
    setPosLoadOrderId(order.id);
    setPosResetKey((k) => k + 1);
    setActiveTab("pos");
  };

  /** Starts a fresh walk-in order. Called by the oversized "New Order"
   *  controls in the sidebar rail and the top bar, so a cashier can begin a
   *  sale from anywhere in the app without hunting for the till. Bumping the
   *  reset key forces the till to drop its previous ticket. */
  /* ------------------------------------------------------------------
   *  "New Order" is reachable from the top bar and the sidebar, and it drops
   *  whatever ticket the till is holding. When a ticket has items we ask
   *  first — a misplaced finger should never silently destroy a sale. */
  const [lostTicket, setLostTicket] = useState<{ items: number; total: number } | null>(null);
  // < md the sidebar is a slide-in drawer, so it needs its own open/closed
  // state. md and up ignore it entirely (the rail is always in flow).
  const [menuOpen, setMenuOpen] = useState(false);
  const [queuedOrders, setQueuedOrders] = useState(0);
  const isOnline = useOnlineStatus();

  // The queue lives in localStorage and can grow while the app is open; poll it
  // so the banner and the tab bar never under-report what is waiting to sync.
  useEffect(() => {
    const branchId = currentUser?.branchId;
    if (!branchId) return;
    const sync = () => setQueuedOrders(getOfflineQueue(branchId).length);
    sync();
    const timer = setInterval(sync, 2000);
    return () => clearInterval(timer);
  }, [currentUser?.branchId]);

  // A queued order is only truly safe once the server has it. Send it the
  // moment the connection returns, and say plainly what still has to be done
  // by hand (the money: offline orders are deliberately unpaid).
  useEffect(() => {
    const branchId = currentUser?.branchId;
    if (!isOnline || !branchId || queuedOrders === 0) return;
    let cancelled = false;
    (async () => {
      const { syncOfflineQueueToServer } = await import("@/lib/offline-storage");
      const result = await syncOfflineQueueToServer(branchId);
      if (cancelled) return;
      if (result.success && result.count > 0) {
        notify(`Sent ${result.count} offline order${result.count === 1 ? "" : "s"} to the server. Collect any payments that were taken on paper.`, "ok");
      }
      setQueuedOrders(getOfflineQueue(branchId).length);
      fetchOperationalData();
    })();
    return () => {
      cancelled = true;
    };
  }, [isOnline, queuedOrders, currentUser?.branchId, fetchOperationalData]);

  // The offline label may not outlive the outage: when the connection is back,
  // ask the server who we are before dropping it. Only a real answer clears it.
  useEffect(() => {
    if (!isOnline || !offlineSession) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch("/api/auth/me");
        if (cancelled || !data?.authenticated) return;
        setCurrentUser(data.user);
        saveIdentity(data.user);
        setOfflineSession(false);
        notify("Back online — the till is talking to the server again.", "ok");
      } catch {
        /* audit-ok: still unreachable — the offline strip stays on screen saying exactly that */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOnline, offlineSession]);

  // Escape closes the drawer, and so does rotating a phone into (or resizing
  // to) a width where the rail is permanently visible again — otherwise the
  // backdrop would be left covering a layout that no longer has a drawer.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = () => {
      if (mq.matches) setMenuOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => {
      window.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onChange);
    };
  }, [menuOpen]);

  const beginNewOrder = () => {
    clearTicketDraft(currentUser?.id ?? "anon");
    setActiveTableId(null);
    setPosResetKey((k) => k + 1);
    setActiveTab("pos");
  };

  const handleStartNewOrder = () => {
    const draft = readTicketDraft<any>(currentUser?.id ?? "anon");
    if (draft.length > 0) {
      setLostTicket({
        items: draft.length,
        total: draft.reduce((sum, it) => sum + Number(it.totalPrice || 0), 0),
      });
      return;
    }
    beginNewOrder();
  };


  /** Open dine-in tables, shown as a glanceable count on the Tables button. */
  const openTableCount = tables.filter((t) => t.status === "occupied").length;

  // --- Session boot states -------------------------------------------------
  if (authState === "checking") {
    return (
      <div className="h-dvh w-full flex flex-col items-center justify-center bg-neutral-950 gap-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-xl shadow-orange-500/20">
          <Store className="w-7 h-7 text-white" />
        </div>
        <div className="flex items-center gap-2 text-sm text-neutral-400">
          <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
          <span>Restoring secure terminal session...</span>
        </div>
      </div>
    );
  }

  if (authState === "out" || !currentUser) {
    return <LoginScreen onAuthenticated={handleAuthenticated} />;
  }

  // --- Authenticated workspace --------------------------------------------
  // Effective permissions: role defaults plus the owner's per-user selections.
  const perms = currentUser?.permissions ?? ROLE_PERMISSIONS[currentUser?.role as UserRole] ?? ROLE_PERMISSIONS.cashier;

  /** Client-side guard mirroring the sidebar gates. The matching API routes
   *  enforce the same rules server-side, so this is UX only. */
  const tabAllowed: Record<NavTab, boolean> = {
    pos: perms.canAccessPos,
    tables: perms.canAccessPos,
    kds: perms.canAccessKds,
    orders: perms.canViewOrderHistory,
    menu: perms.canManageMenu,
    recipes: perms.canManageMenu,
    inventory: perms.canModifyInventory,
    purchasing: perms.canModifyInventory,
    dashboard: perms.canViewReports,
    reports: perms.canViewReports,
    shifts: perms.canViewDrawerHistory,
    staff: perms.canManageStaff,
    audit: perms.canViewTransactionTrail,
    integrations: perms.canManageSettings,
    settings: perms.canManageSettings,
    deployment: perms.canManageSettings,
  };

  const renderDenied = () => (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 gap-3">
      <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
        <ShieldAlert className="w-7 h-7 text-rose-400" />
      </div>
      <h3 className="text-base font-bold text-white">Access Restricted</h3>
      <p className="text-xs text-neutral-400 max-w-sm">
        Your role ({perms.label}) is not authorized to open this module. Ask a
        manager to switch the terminal user or adjust your permissions.
      </p>
    </div>
  );

  // One controls strip, two homes: across the top of the work area on
  // most screens, but on the POS it sits above the menu column only
  // (passed into PosTerminal) so the bill panel extends to the very top.
  const terminalControls = (
    <TerminalControls
      currentUser={currentUser}
      lowStockCount={lowStockCount}
      onUserChange={handleUserChange}
      onLogout={handleLogout}
    />
  );

  const renderTab = () => {
    if (!tabAllowed[activeTab]) return renderDenied();

    switch (activeTab) {
      case "dashboard":
        return <OwnerDashboard onNavigate={setActiveTab} openShift={openShift} perms={perms} />;
      case "pos":
        return (
          <PosTerminal key={`${currentUser?.id ?? "anon"}:${posResetKey}`}
            categories={categories}
            menuItems={menuItems}
            tables={tables}
            currentUser={currentUser}
            activeTableId={activeTableId}
            onOrderCreated={fetchOperationalData}
            headerControls={terminalControls}
            loadOrderId={posLoadOrderId}
          />
        );
      case "tables":
        return (
          <TableFloorPlan
            areas={areas}
            tables={tables}
            onOpenPosForTable={handleOpenPosForTable}
            onRefresh={fetchOperationalData}
          />
        );
      case "kds":
        return <KitchenDisplaySystem />;
      case "orders":
        return <OrdersHistory currentUser={currentUser} onOpenInPos={handleOpenOrderInPos} />;
      case "menu":
        return (
          <MenuManager
            categories={categories}
            menuItems={menuItems}
            onRefresh={fetchOperationalData}
            canDeleteItems={currentUser.role === "super_admin"}
          />
        );
      case "recipes":
        return <RecipeManager />;
      case "inventory":
        return <InventoryManager />;
      case "purchasing":
        return <PurchasingManager />;
      case "shifts":
        return <ShiftCashDrawer currentUser={currentUser} readOnly={!perms.canAccessPos} />;
      case "reports":
        return <ReportsDashboard canExportTransactions={perms.canViewTransactionTrail} />;
      case "staff":
        return <StaffManager currentUser={currentUser} />;
      case "audit":
        return <AuditLogsViewer />;
      case "integrations":
        return <IntegrationsManager />;
      case "settings":
        return <RestaurantSettings />;
      case "deployment":
        return <DeploymentHub />;
      default:
        return renderDenied();
    }
  };

  return (
    <div className="flex flex-col h-dvh w-full pt-safe overflow-hidden bg-neutral-950 text-white font-sans">
      {/* Top bar is phone-only now: on md+ its brand, register state, display
          size, online state, fullscreen, Switch Staff and user controls live
          in the rail (Sidebar), which frees the bar's 72px for the work area
          — most importantly the POS bill panel's items list. */}
      <div className="md:hidden">
        <Navbar
          onOpenMenu={() => setMenuOpen(true)}
          currentUser={currentUser}
          onUserChange={handleUserChange}
          onLogout={handleLogout}
          lowStockCount={lowStockCount}
          openShift={openShift}
        />
      </div>

      {/* Connection state, always visible while it matters. Offline is not an
          error here: the till keeps working, so the strip says what still works
          and what is waiting, instead of blocking the screen. */}
      {(!isOnline || offlineSession || queuedOrders > 0) && (
        <div
          className={`shrink-0 px-3 py-2 flex items-center gap-2 text-xs sm:text-sm font-semibold border-b ${
            isOnline
              ? "bg-sky-500/10 border-sky-500/30 text-sky-200"
              : "bg-amber-500/10 border-amber-500/30 text-amber-100"
          }`}
          role="status"
        >
          <span className={`w-2 h-2 rounded-full shrink-0 ${isOnline ? "bg-sky-400" : "bg-amber-400 animate-pulse"}`} />
          <span className="flex-1 leading-snug">
            {offlineSession && isOnline
              ? "Server unreachable — running offline from this device's last sign-in."
              : isOnline
                ? `${queuedOrders} offline order${queuedOrders === 1 ? "" : "s"} waiting to sync.`
                : `Offline — orders are saved on this device${queuedOrders > 0 ? ` (${queuedOrders} waiting)` : ""}. Payments are recorded once the server is reachable.`}
          </span>
          {isOnline && queuedOrders > 0 && (
            <button
              onClick={async () => {
                if (!currentUser) return;
                const { syncOfflineQueueToServer } = await import("@/lib/offline-storage");
                const result = await syncOfflineQueueToServer(currentUser.branchId);
                if (result.success && result.count > 0) {
                  notify(`Sent ${result.count} offline order${result.count === 1 ? "" : "s"} to the server. Collect any payments that were taken on paper.`, "ok");
                } else if (!result.success) {
                  notify(result.error ? `Sync failed: ${result.error} — the offline orders are still on this device.` : "Could not reach the server — the offline orders are still on this device.", "error");
                } else {
                  notify("Nothing waiting to sync.", "ok");
                }
                setQueuedOrders(getOfflineQueue(currentUser.branchId).length);
                fetchOperationalData();
              }}
              className="shrink-0 h-11 px-4 rounded-xl bg-white/10 hover:bg-white/20 font-bold"
            >
              Sync now
            </button>
          )}
        </div>
      )}

      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        {/* Backdrop for the phone drawer. Hidden from md up, where the rail is
            part of the layout instead of an overlay. */}
        {menuOpen && (
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
        )}
        <Sidebar
          mobileOpen={menuOpen}
          onCloseMobile={() => setMenuOpen(false)}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onNewOrder={handleStartNewOrder}
          openTableCount={openTableCount}
          shiftOpen={!!openShift}
          userRole={currentUser?.role}
          userPermissions={currentUser?.permissions}
        />

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Slim top strip (md+): user, Switch Staff, display size, online
              state, fullscreen — across the top of the work area on most
              screens. On the POS it is NOT rendered here: PosTerminal
              shows it above the menu column instead, so the bill panel
              extends to the very top (Oct 2026). Phones use the Navbar. */}
          {activeTab !== "pos" && terminalControls}
          <main className="flex-1 flex flex-col min-h-0 overflow-hidden bg-neutral-950">
            {renderTab()}
          </main>
        </div>
      </div>

      {/* Phones: the five screens a shift lives in, within thumb reach. */}
      <MobileTabBar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        userRole={currentUser?.role}
        openTableCount={openTableCount}
        shiftOpen={!!openShift}
      />

      <Toaster />

      <ConfirmDialog
        open={!!lostTicket}
        title="Start a new ticket?"
        message={
          lostTicket
            ? `The current ticket has ${lostTicket.items} item${lostTicket.items === 1 ? "" : "s"} (GH₵${lostTicket.total.toFixed(2)}). Starting a new ticket discards it.`
            : ""
        }
        cancelLabel="Keep the ticket"
        confirmLabel="Discard & start new"
        onCancel={() => setLostTicket(null)}
        onConfirm={() => {
          setLostTicket(null);
          beginNewOrder();
        }}
      />
    </div>
  );
}
