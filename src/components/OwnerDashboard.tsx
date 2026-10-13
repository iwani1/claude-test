"use client";

import React, { useState, useEffect } from "react";
import {
  LayoutDashboard,
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Grid,
  ChefHat,
  AlertTriangle,
  Boxes,
  Users,
  CreditCard,
  Banknote,
  RotateCcw,
  Clock,
  ArrowUpRight,
} from "lucide-react";
import { NavTab } from "./Sidebar";
import { ROLE_PERMISSIONS, UserRole } from "@/lib/permissions";

interface OwnerDashboardProps {
  onNavigate: (tab: NavTab) => void;
  openShift?: any;
  /** The viewer's rights, so a tile only ever leads to a screen they can open. */
  perms?: (typeof ROLE_PERMISSIONS)[UserRole];
}

export const OwnerDashboard: React.FC<OwnerDashboardProps> = ({ onNavigate, openShift, perms }) => {
  const [reports, setReports] = useState<any>(null);
  const [tables, setTables] = useState<any[]>([]);
  const [activeTickets, setActiveTickets] = useState<any[]>([]);
  const [inventoryStats, setInventoryStats] = useState<any>(null);
  /**
   * Why a panel has no data. A panel must never answer a refused or failed
   * request with a zero or an "all clear": "GH₵0.00 today" and "all tables
   * available" are statements about the venue, and neither is true when the
   * request came back 403 or 500.
   */
  const [panelErrors, setPanelErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const load = (key: string, url: string, onData: (data: any) => void) =>
      fetch(url)
        .then((r) => {
          if (!r.ok) throw new Error(r.status === 403 ? "Not available to your role" : `Could not load (${r.status})`);
          return r.json();
        })
        .then(onData)
        .catch((e) => setPanelErrors((prev) => ({ ...prev, [key]: e?.message || "Could not load" })));

    load("reports", "/api/reports?timeframe=today", (d) => setReports(d));
    load("tables", "/api/tables", (d) => setTables(d.tables || []));
    load("kds", "/api/kds", (d) => setActiveTickets(d.tickets || []));
    load("inventory", "/api/inventory", (d) => setInventoryStats(d));
  }, []);

  const summary = reports?.summary || {
    totalSales: "0.00",
    totalOrdersCount: 0,
    avgOrderValue: "0.00",
    grossProfit: "0.00",
    foodCostPercentage: "0.0",
  };

  const canOpen = {
    till: perms?.canAccessPos ?? true,
    kds: perms?.canAccessKds ?? true,
    stock: perms?.canModifyInventory ?? true,
    drawer: perms?.canViewDrawerHistory ?? true,
    settings: perms?.canManageSettings ?? true,
  };
  const occupiedTables = tables.filter((t) => t.status === "occupied");
  const lowStockAlerts = reports?.lowStockAlerts || [];
  const payments = reports?.paymentBreakdown || { cash: 0, card: 0, stripe: 0 };

  return (
    <div className="flex-1 flex flex-col h-full bg-neutral-950 overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-neutral-900 border-b border-neutral-800 flex justify-between items-center">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5 text-amber-500" />
            <span>Executive Business Command Center</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Remote real-time operations, sales telemetry, and restaurant performance
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-800 border border-neutral-700 text-neutral-300">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Today&apos;s Live Metrics</span>
          </span>
        </div>
      </div>

      {/* Dashboard Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {/* Row 1: Primary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          <div
            onClick={() => onNavigate("reports")}
            className="bg-neutral-900 border border-neutral-800 hover:border-amber-500/50 rounded-2xl p-4 shadow-lg cursor-pointer transition group"
          >
            <div className="flex justify-between items-center text-neutral-400">
              <span className="text-[0.625rem] uppercase font-bold tracking-wider">
                Total Sales Today
              </span>
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
              {panelErrors.reports ? (
                <span className="text-xs font-semibold text-rose-300">{panelErrors.reports}</span>
              ) : (
                <>GH₵{Number(summary.netCollections ?? 0).toFixed(2)}</>
              )}
            </div>
            <div className="text-[0.6875rem] text-neutral-500 mt-1 flex justify-between">
              <span>
                {panelErrors.reports ? "Sales figures unavailable" : `${summary.totalOrdersCount} orders placed`}
              </span>
              <span className="text-amber-400 group-hover:translate-x-0.5 transition">View &rarr;</span>
            </div>
          </div>

          <div
            onClick={() => onNavigate("tables")}
            className="bg-neutral-900 border border-neutral-800 hover:border-amber-500/50 rounded-2xl p-4 shadow-lg cursor-pointer transition group"
          >
            <div className="flex justify-between items-center text-neutral-400">
              <span className="text-[0.625rem] uppercase font-bold tracking-wider">
                Active Dine-in Tables
              </span>
              <Grid className="w-4 h-4 text-sky-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-white mt-1">
              {panelErrors.tables ? (
                <span className="text-xs font-semibold text-rose-300">{panelErrors.tables}</span>
              ) : (
                <>{occupiedTables.length} / {tables.length}</>
              )}
            </div>
            <div className="text-[0.6875rem] text-neutral-500 mt-1 flex justify-between">
              <span>
                {panelErrors.tables
                  ? "Floor data unavailable"
                  : tables.length > 0 ? `${Math.round((occupiedTables.length / tables.length) * 100)}% occupancy` : "0%"}
              </span>
              <span className="text-amber-400 group-hover:translate-x-0.5 transition">Floor &rarr;</span>
            </div>
          </div>

          <div
            onClick={() => onNavigate("kds")}
            className="bg-neutral-900 border border-neutral-800 hover:border-amber-500/50 rounded-2xl p-4 shadow-lg cursor-pointer transition group"
          >
            <div className="flex justify-between items-center text-neutral-400">
              <span className="text-[0.625rem] uppercase font-bold tracking-wider">
                Active Kitchen Tickets
              </span>
              <ChefHat className="w-4 h-4 text-orange-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-amber-400 mt-1">
              {panelErrors.kds ? (
                <span className="text-xs font-semibold text-rose-300">{panelErrors.kds}</span>
              ) : (
                <>{activeTickets.length} tickets</>
              )}
            </div>
            <div className="text-[0.6875rem] text-neutral-500 mt-1 flex justify-between">
              <span>{panelErrors.kds ? "Kitchen data unavailable" : "On prep lines"}</span>
              <span className="text-amber-400 group-hover:translate-x-0.5 transition">KDS &rarr;</span>
            </div>
          </div>

          <div
            onClick={() => onNavigate("inventory")}
            className="bg-neutral-900 border border-neutral-800 hover:border-amber-500/50 rounded-2xl p-4 shadow-lg cursor-pointer transition group"
          >
            <div className="flex justify-between items-center text-neutral-400">
              <span className="text-[0.625rem] uppercase font-bold tracking-wider">
                Inventory Valuation
              </span>
              <Boxes className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-white mt-1">
              {panelErrors.inventory ? (
                <span className="text-xs font-semibold text-rose-300">{panelErrors.inventory}</span>
              ) : (
                <>GH₵{Number(inventoryStats?.totalValuation || 0).toLocaleString()}</>
              )}
            </div>
            <div className="text-[0.6875rem] text-neutral-500 mt-1 flex justify-between">
              <span className={lowStockAlerts.length > 0 ? "text-rose-400 font-semibold" : ""}>
                {panelErrors.reports ? "Stock alerts unavailable" : `${lowStockAlerts.length} low stock alerts`}
              </span>
              <span className="text-amber-400 group-hover:translate-x-0.5 transition">Stock &rarr;</span>
            </div>
          </div>
        </div>

        {/* Row 2: Occupancy & Kitchen Status */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Active Tables Occupancy */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-xl space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Grid className="w-4 h-4 text-sky-400" />
                <span>Currently Seated Tables</span>
              </h3>
              {canOpen.till && (
                <button
                  onClick={() => onNavigate("tables")}
                  className="text-xs text-amber-400 hover:text-amber-300 font-medium"
                >
                  Manage &rarr;
                </button>
              )}
            </div>

            <div className="space-y-2">
              {panelErrors.tables ? (
                <div className="py-6 text-center text-xs text-rose-300">{panelErrors.tables}</div>
              ) : occupiedTables.slice(0, 4).map((tbl) => (
                <div
                  key={tbl.id}
                  className="p-2.5 bg-neutral-850 rounded-xl border border-neutral-800 flex justify-between items-center text-xs"
                >
                  <div>
                    <span className="font-bold text-white font-mono">{tbl.tableNumber}</span>
                    <span className="text-neutral-400 text-[0.6875rem] ml-2">
                      {tbl.activeOrder?.customerName || "Dine-in"}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-amber-400">
                    GH₵{Number(tbl.activeOrder?.totalAmount || 0).toFixed(2)}
                  </span>
                </div>
              ))}

              {!panelErrors.tables && occupiedTables.length === 0 && (
                <div className="py-6 text-center text-neutral-500 text-xs">
                  All tables currently available.
                </div>
              )}
            </div>
          </div>

          {/* Pending Kitchen Orders */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-xl space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ChefHat className="w-4 h-4 text-orange-400" />
                <span>Active Kitchen Line</span>
              </h3>
              {canOpen.kds && (
                <button
                  onClick={() => onNavigate("kds")}
                  className="text-xs text-amber-400 hover:text-amber-300 font-medium"
                >
                  Open KDS &rarr;
                </button>
              )}
            </div>

            <div className="space-y-2">
              {panelErrors.kds ? (
                <div className="py-6 text-center text-xs text-rose-300">{panelErrors.kds}</div>
              ) : activeTickets.slice(0, 4).map((t) => (
                <div
                  key={t.id}
                  className="p-2.5 bg-neutral-850 rounded-xl border border-neutral-800 flex justify-between items-center text-xs"
                >
                  <div>
                    <span className="font-bold text-white font-mono">#{t.ticketNumber}</span>
                    <span className="text-[0.6875rem] text-neutral-400 ml-2">
                      {t.tableNumber} ({t.items?.length || 1} items)
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[0.625rem] font-bold uppercase">
                    {t.status}
                  </span>
                </div>
              ))}

              {!panelErrors.kds && activeTickets.length === 0 && (
                <div className="py-6 text-center text-neutral-500 text-xs">
                  No pending kitchen tickets.
                </div>
              )}
            </div>
          </div>

          {/* Low Stock Alerts */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-xl space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>Low Inventory Stock Warnings</span>
              </h3>
              {canOpen.stock && (
                <button
                  onClick={() => onNavigate("inventory")}
                  className="text-xs text-amber-400 hover:text-amber-300 font-medium"
                >
                  Restock &rarr;
                </button>
              )}
            </div>

            <div className="space-y-2">
              {panelErrors.reports ? (
                <div className="py-6 text-center text-xs text-rose-300">{panelErrors.reports}</div>
              ) : lowStockAlerts.slice(0, 4).map((ing: any) => (
                <div
                  key={ing.id}
                  className="p-2.5 bg-rose-950/20 border border-rose-900/40 rounded-xl flex justify-between items-center text-xs"
                >
                  <div>
                    <span className="font-semibold text-rose-200">{ing.name}</span>
                    <span className="text-[0.625rem] text-rose-400 block">
                      Min threshold: {Number(ing.minStockLevel).toFixed(1)} {ing.unit}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-rose-300">
                    {Number(ing.currentStock).toFixed(1)} {ing.unit}
                  </span>
                </div>
              ))}

              {!panelErrors.reports && lowStockAlerts.length === 0 && (
                <div className="py-6 text-center text-neutral-500 text-xs">
                  All ingredient stocks healthy.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Row 3: Quick Navigation Command Tiles. Each one leads to a screen the
            viewer can actually use, so no tile ends at an access denial. */}
        {(canOpen.till || canOpen.drawer || canOpen.stock || canOpen.settings) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          {canOpen.till && (
          <button
            onClick={() => onNavigate("pos")}
            className="p-4 bg-gradient-to-br from-amber-600 to-orange-600 rounded-2xl text-left text-black font-bold shadow-lg shadow-orange-500/20 hover:scale-[1.02] transition"
          >
            <ShoppingBag className="w-6 h-6 mb-2" />
            <div className="text-sm">Launch POS Terminal</div>
            <div className="text-xs font-normal opacity-90">Take orders, print receipts</div>
          </button>
          )}

          {canOpen.drawer && (
          <button
            onClick={() => onNavigate("shifts")}
            className="p-4 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 rounded-2xl text-left text-white shadow-lg hover:scale-[1.02] transition"
          >
            <Banknote className="w-6 h-6 text-emerald-400 mb-2" />
            <div className="text-sm font-bold">Register & Shifts</div>
            <div className="text-xs text-neutral-400">Drawer audit & cash drops</div>
          </button>
          )}

          {canOpen.stock && (
          <button
            onClick={() => onNavigate("purchasing")}
            className="p-4 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 rounded-2xl text-left text-white shadow-lg hover:scale-[1.02] transition"
          >
            <Boxes className="w-6 h-6 text-sky-400 mb-2" />
            <div className="text-sm font-bold">Purchasing & GRN</div>
            <div className="text-xs text-neutral-400">Order from suppliers</div>
          </button>
          )}

          {canOpen.settings && (
          <button
            onClick={() => onNavigate("deployment")}
            className="p-4 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 rounded-2xl text-left text-white shadow-lg hover:scale-[1.02] transition"
          >
            <Users className="w-6 h-6 text-amber-400 mb-2" />
            <div className="text-sm font-bold">Hosting Package</div>
            <div className="text-xs text-neutral-400">Hosting files & staff guides</div>
          </button>
          )}
        </div>
        )}
      </div>
    </div>
  );
};
