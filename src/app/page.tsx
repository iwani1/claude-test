"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Loader2, Store, ShieldAlert } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Sidebar, NavTab } from "@/components/Sidebar";
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
import { saveMenuToCache, getCachedMenu } from "@/lib/offline-storage";
import { ROLE_PERMISSIONS, UserRole } from "@/lib/permissions";

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
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<NavTab>("pos");

  const [categories, setCategories] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  const [openShift, setOpenShift] = useState<any | null>(null);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [activeTableId, setActiveTableId] = useState<number | null>(null);
  // Bumped every time "New Order" is tapped so the till clears its ticket.
  const [posResetKey, setPosResetKey] = useState(0);

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
      setAreas(tablesData.areas || []); setTables(tablesData.tables || []);
      setOpenShift(shiftsData.activeShift || null); setLowStockCount(invData.lowStockCount || 0);
    }).catch(() => {
      const cached = getCachedMenu(currentBranchId);
      if (cached) { setCategories(cached.categories || []); setMenuItems(cached.items || []); }
    });
  }, [currentBranchId]);

  /** Verify the signed session cookie on mount. */
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();
        if (data.authenticated && data.user) {
          setCurrentUser(data.user);
          setActiveTab(DEFAULT_TAB[data.user.role as UserRole] ?? "pos");
          setAuthState("in");
        } else {
          setAuthState("out");
        }
      } catch {
        setAuthState("out");
      }
    })();
  }, []);

  // Load operational data only once authenticated.
  useEffect(() => {
    if (authState === "in") fetchOperationalData();
  }, [authState, fetchOperationalData]);

  const handleAuthenticated = (user: any) => {
    setCurrentUser(user);
    setActiveTab(DEFAULT_TAB[user.role as UserRole] ?? "pos");
    setAuthState("in");
  };

  /** Switching users via PIN re-points the landing tab to the new role. */
  const handleUserChange = (user: any) => {
    setCurrentUser(user);
    setActiveTab(DEFAULT_TAB[user.role as UserRole] ?? "pos");
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    } catch {
      /* clearing local state regardless */
    }
    setCategories([]); setMenuItems([]); setAreas([]); setTables([]); setOpenShift(null);
    setCurrentUser(null);
    setAuthState("out");
  };

  const handleOpenPosForTable = (tableId: number) => {
    setActiveTableId(tableId);
    setPosResetKey((k) => k + 1);
    setActiveTab("pos");
  };

  /** Starts a fresh walk-in order. Called by the oversized "New Order"
   *  controls in the sidebar rail and the top bar, so a cashier can begin a
   *  sale from anywhere in the app without hunting for the till. Bumping the
   *  reset key forces the till to drop its previous ticket. */
  const handleStartNewOrder = () => {
    setActiveTableId(null);
    setPosResetKey((k) => k + 1);
    setActiveTab("pos");
  };

  const handleOpenDrawer = () => setActiveTab("shifts");
  const handleGoTables = () => setActiveTab("tables");
  const handleGoOrders = () => setActiveTab("orders");

  /** Open dine-in tables, shown as a glanceable count on the Tables button. */
  const openTableCount = tables.filter((t) => t.status === "occupied").length;

  // --- Session boot states -------------------------------------------------
  if (authState === "checking") {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-neutral-950 gap-4">
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

  if (authState === "out") {
    return <LoginScreen onAuthenticated={handleAuthenticated} />;
  }

  // --- Authenticated workspace --------------------------------------------
  const perms = ROLE_PERMISSIONS[currentUser?.role as UserRole] ?? ROLE_PERMISSIONS.cashier;

  /** Client-side guard mirroring the sidebar gates. The matching API routes
   *  enforce the same rules server-side, so this is UX only. */
  const tabAllowed: Record<NavTab, boolean> = {
    pos: perms.canAccessPos,
    tables: perms.canAccessPos,
    kds: perms.canAccessKds,
    orders: perms.canAccessPos || perms.canViewReports,
    menu: perms.canManageMenu,
    recipes: perms.canManageMenu,
    inventory: perms.canModifyInventory,
    purchasing: perms.canModifyInventory,
    dashboard: perms.canViewReports,
    reports: perms.canViewReports,
    shifts: perms.canAccessPos || perms.canViewReports,
    staff: perms.canManageStaff,
    audit: perms.canViewReports,
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

  const renderTab = () => {
    if (!tabAllowed[activeTab]) return renderDenied();

    switch (activeTab) {
      case "dashboard":
        return <OwnerDashboard onNavigate={setActiveTab} openShift={openShift} />;
      case "pos":
        return (
          <PosTerminal key={`${currentUser.id}:${posResetKey}`}
            categories={categories}
            menuItems={menuItems}
            tables={tables}
            currentUser={currentUser}
            activeTableId={activeTableId}
            onOrderCreated={fetchOperationalData}
            onOpenDrawer={handleOpenDrawer}
            onGoTables={handleGoTables}
            onGoOrders={handleGoOrders}
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
        return <OrdersHistory currentUser={currentUser} />;
      case "menu":
        return (
          <MenuManager
            categories={categories}
            menuItems={menuItems}
            onRefresh={fetchOperationalData}
          />
        );
      case "recipes":
        return <RecipeManager />;
      case "inventory":
        return <InventoryManager />;
      case "purchasing":
        return <PurchasingManager />;
      case "shifts":
        return <ShiftCashDrawer currentUser={currentUser} />;
      case "reports":
        return <ReportsDashboard />;
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
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-neutral-950 text-white font-sans">
      <Navbar
        currentUser={currentUser}
        onUserChange={handleUserChange}
        onLogout={handleLogout}
        lowStockCount={lowStockCount}
        openShift={openShift}
        onNewOrder={handleStartNewOrder}
        onOpenDrawer={handleOpenDrawer}
        onGoTables={handleGoTables}
        onGoOrders={handleGoOrders}
        currentTab={activeTab}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          activeTab={activeTab}
          onTabChange={(tab) => {
            setActiveTab(tab);
            if (tab !== "pos") setActiveTableId(null);
          }}
          onNewOrder={handleStartNewOrder}
          openTableCount={openTableCount}
          shiftOpen={!!openShift}
          userRole={currentUser?.role}
        />

        <main className="flex-1 flex flex-col overflow-hidden bg-neutral-950">
          {renderTab()}
        </main>
      </div>
    </div>
  );
}
