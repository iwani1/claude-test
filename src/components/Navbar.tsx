"use client";

import React, { useState, useEffect } from "react";
import {
  Store,
  Wifi,
  WifiOff,
  UserCheck,
  RefreshCw,
  Maximize,
  ChevronDown,
  ShieldAlert,
  Clock,
  KeyRound,
  LogOut,
  Plus,
  Coins,
  Grid,
  Receipt,
} from "lucide-react";
import { ROLE_PERMISSIONS, UserRole, hasTerminalAccess } from "@/lib/permissions";
import { getOfflineQueue, syncOfflineQueueToServer } from "@/lib/offline-storage";

interface NavbarProps {
  currentUser: any;
  onUserChange: (user: any) => void;
  lowStockCount?: number;
  openShift?: any;
  onLogout?: () => void;
  onNewOrder?: () => void;
  onOpenDrawer?: () => void;
  onGoTables?: () => void;
  onGoOrders?: () => void;
  currentTab?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  onUserChange,
  lowStockCount = 0,
  openShift,
  onLogout,
  onNewOrder,
  onOpenDrawer,
  onGoTables,
  onGoOrders,
  currentTab,
}) => {
  const [isOnline, setIsOnline] = useState(true);
  const [offlineCount, setOfflineCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    setIsOnline(navigator.onLine);

    const checkQueue = () => {
      setOfflineCount(getOfflineQueue(currentUser.branchId).length);
    };
    checkQueue();
    const interval = setInterval(checkQueue, 4000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, [currentUser.branchId]);

  const handleManualSync = async () => {
    setIsSyncing(true);
    const res = await syncOfflineQueueToServer(currentUser.branchId);
    setIsSyncing(false);
    setOfflineCount(getOfflineQueue(currentUser.branchId).length);
    if (res.success && res.count > 0) {
      alert(`Successfully synchronized ${res.count} offline orders to the server!`);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const currentRoleInfo = currentUser?.role
    ? ROLE_PERMISSIONS[currentUser.role as UserRole]
    : null;

  // Only roles permitted to open a session are offered for switching.
  // Kitchen staff have no terminal access, so they are never listed.
  const switchableRoles = (Object.keys(ROLE_PERMISSIONS) as UserRole[]).filter((r) =>
    hasTerminalAccess(r)
  );

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError("");
    try {
      const res = await fetch("/api/auth/switch-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pinInput }),
      });
      const data = await res.json();
      if (data.success && data.user) {
        onUserChange(data.user);
        setShowPinModal(false);
        setPinInput("");
      } else {
        setPinError(data.error || "Invalid PIN code");
      }
    } catch {
      setPinError("Failed to authenticate PIN");
    }
  };



  return (
    <>
      {/* 72px bar keeps every control above comfortable finger size */}
      <header className="h-[72px] bg-neutral-900 border-b border-neutral-800 text-white flex items-center justify-between px-4 lg:px-5 select-none shrink-0 z-40">
        {/* Left: Brand & Branch Context */}
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/20 shrink-0">
            <Store className="w-6 h-6 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-[15px] tracking-tight text-neutral-100 truncate">
                Asanka Royal Bistro &amp; Lounge
              </span>
              <span className="hidden xl:inline-block px-2 py-0.5 text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-full shrink-0">
                Airport Residential
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[12px] text-neutral-400">
              <Clock className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
              {openShift ? (
                <span className="text-emerald-400 font-medium">Register Open</span>
              ) : (
                <span className="text-amber-400 font-medium">Register Closed</span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Actions, Network Status & Profile */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* POS quick jumps — New Order / Tables / Orders / Drawer always visible */}
          {(onNewOrder || onGoTables || onGoOrders || onOpenDrawer) && (
            <div className="hidden md:flex items-center gap-2 mr-1">
              {onNewOrder && (
                <button
                  onClick={onNewOrder}
                  className={`h-11 px-4 font-bold rounded-xl flex items-center gap-2 shadow-lg transition active:scale-[0.97] text-[13px] ${
                    currentTab === "pos"
                      ? "bg-amber-400 text-black shadow-amber-500/20 ring-2 ring-amber-200"
                      : "bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-black shadow-amber-500/20"
                  }`}
                  title="Start a new order (clears the ticket)"
                >
                  <Plus className="w-5 h-5" strokeWidth={3} />
                  <span>New Order</span>
                </button>
              )}
              {onGoTables && (
                <button
                  onClick={onGoTables}
                  className={`h-11 px-3.5 font-bold rounded-xl flex items-center gap-2 border transition active:scale-[0.97] text-[13px] ${
                    currentTab === "tables"
                      ? "bg-neutral-100 text-black border-neutral-100"
                      : "bg-neutral-800 hover:bg-neutral-750 text-white border-neutral-700"
                  }`}
                  title="Go to tables & floor plan"
                >
                  <Grid className="w-5 h-5" />
                  <span className="hidden lg:inline">Tables</span>
                </button>
              )}
              {onGoOrders && (
                <button
                  onClick={onGoOrders}
                  className={`h-11 px-3.5 font-bold rounded-xl flex items-center gap-2 border transition active:scale-[0.97] text-[13px] ${
                    currentTab === "orders"
                      ? "bg-neutral-100 text-black border-neutral-100"
                      : "bg-neutral-800 hover:bg-neutral-750 text-white border-neutral-700"
                  }`}
                  title="Go to past orders"
                >
                  <Receipt className="w-5 h-5" />
                  <span className="hidden lg:inline">Orders</span>
                </button>
              )}
              {onOpenDrawer && (
                <button
                  onClick={onOpenDrawer}
                  className={`h-11 px-3.5 font-bold rounded-xl flex items-center gap-2 border transition active:scale-[0.97] text-[13px] ${
                    currentTab === "shifts"
                      ? "bg-emerald-400 text-black border-emerald-400"
                      : "bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border-emerald-500/50"
                  }`}
                  title={openShift ? "Cash drawer is open — manage shift" : "Cash drawer is closed — open shift"}
                >
                  <span className="relative flex">
                    <Coins className="w-5 h-5" />
                    <span
                      className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-neutral-900 ${
                        openShift ? "bg-emerald-400" : "bg-rose-500"
                      }`}
                    />
                  </span>
                  <span className="hidden lg:inline">Drawer</span>
                </button>
              )}
            </div>
          )}

          {/* Network status */}
          <div className="flex items-center gap-1.5 px-3 h-11 rounded-xl bg-neutral-800/80 border border-neutral-700/60 text-[12px]">
            {isOnline ? (
              <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <Wifi className="w-4 h-4" />
                <span className="hidden lg:inline">Online</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-amber-400 font-medium">
                <WifiOff className="w-4 h-4" />
                <span className="hidden sm:inline">Offline</span>
              </span>
            )}

            {offlineCount > 0 && (
              <button
                onClick={handleManualSync}
                disabled={isSyncing}
                className="ml-1 px-2.5 h-7 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition"
                title="Sync offline queue"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                <span>{offlineCount}</span>
              </button>
            )}
          </div>

          {/* Low stock alerts badge */}
          {lowStockCount > 0 && (
            <div className="hidden xl:flex items-center gap-1.5 px-3 h-11 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[12px] font-semibold">
              <ShieldAlert className="w-4 h-4" />
              <span>{lowStockCount} low stock</span>
            </div>
          )}

          {/* Fullscreen button */}
          <button
            onClick={toggleFullscreen}
            className="h-11 w-11 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-xl transition hidden sm:flex items-center justify-center"
            title="Toggle fullscreen terminal mode"
          >
            <Maximize className="w-5 h-5" />
          </button>

          {/* Fast PIN switch */}
          <button
            onClick={() => setShowPinModal(true)}
            className="h-11 px-3.5 text-neutral-200 hover:text-white hover:bg-neutral-800 rounded-xl border border-neutral-700/60 flex items-center gap-2 text-[12px] font-semibold transition active:bg-neutral-750"
            title="Switch employee with PIN"
          >
            <KeyRound className="w-5 h-5 text-amber-400" />
            <span className="hidden lg:inline">Switch Staff</span>
          </button>

          {/* User profile & Role switcher */}
          <div className="relative">
            <button
              onClick={() => setShowRoleDropdown(!showRoleDropdown)}
              className="flex items-center gap-2.5 h-11 pl-2 pr-3 rounded-xl bg-neutral-800 hover:bg-neutral-750 border border-neutral-700 transition active:bg-neutral-750"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-600 to-orange-500 flex items-center justify-center text-[13px] font-bold text-white shadow-xs">
                {currentUser?.name ? currentUser.name.charAt(0) : "U"}
              </div>
              <div className="text-left hidden md:block max-w-[150px]">
                <div className="text-[12.5px] font-semibold leading-tight text-neutral-100 truncate">
                  {currentUser?.name || "Staff"}
                </div>
                <div className="text-[10.5px] text-amber-400 font-medium truncate">
                  {currentRoleInfo?.label || currentUser?.role || "Staff"}
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-neutral-400 shrink-0" />
            </button>

            {/* User Profile dropdown */}
            {showRoleDropdown && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowRoleDropdown(false)}
                />
                <div className="absolute right-0 mt-2 w-[280px] bg-neutral-800 border border-neutral-700 rounded-2xl shadow-2xl py-2 z-50">
                  <div className="px-4 py-2.5 border-b border-neutral-700/80">
                    <div className="text-sm font-bold text-white truncate">
                      {currentUser?.name || "Active Staff"}
                    </div>
                    <div className="text-xs text-amber-400 font-semibold mt-0.5">
                      {currentRoleInfo?.label || currentUser?.role}
                    </div>
                    {currentUser?.email && (
                      <div className="text-[11px] text-neutral-400 truncate mt-0.5 font-mono">
                        {currentUser.email}
                      </div>
                    )}
                  </div>

                  <div className="py-1">
                    <button
                      onClick={() => {
                        setShowRoleDropdown(false);
                        setShowPinModal(true);
                      }}
                      className="w-full text-left px-4 py-2.5 text-[13px] font-medium text-neutral-200 hover:bg-neutral-700/60 flex items-center gap-2.5 transition"
                    >
                      <KeyRound className="w-4 h-4 text-amber-400" />
                      <span>Switch Employee (Enter PIN)</span>
                    </button>
                  </div>

                  <div className="pt-1 border-t border-neutral-700/80">
                    <button
                      onClick={() => {
                        setShowRoleDropdown(false);
                        onLogout?.();
                      }}
                      className="w-full text-left px-4 py-2.5 text-[13px] font-semibold text-rose-400 hover:bg-rose-500/10 flex items-center gap-2.5 transition"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out of Terminal</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* PIN Switch Modal */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto mb-3">
              <KeyRound className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Enter Employee PIN</h3>
            <p className="text-[13px] text-neutral-400 mb-5">
              Enter your assigned 4-digit code to switch active operator
            </p>

            <form onSubmit={handlePinSubmit} className="space-y-4">
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                autoFocus
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="••••"
                className="w-full text-center text-4xl tracking-[0.3em] font-mono py-3 bg-neutral-800 border border-neutral-700 rounded-2xl text-white focus:outline-none focus:border-amber-500"
              />

              {pinError && <p className="text-[13px] text-rose-400">{pinError}</p>}

              {/* On-screen numeric pad: POS terminals often have no keyboard */}
              <div className="grid grid-cols-3 gap-2">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setPinInput((p) => (p.length < 4 ? p + d : p))}
                    className="h-14 rounded-xl bg-neutral-800 hover:bg-neutral-700 active:bg-amber-500 active:text-black border border-neutral-700 text-xl font-bold text-white transition"
                  >
                    {d}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPinInput("")}
                  className="h-14 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-[12px] font-bold text-neutral-400 transition"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => setPinInput((p) => (p.length < 4 ? p + "0" : p))}
                  className="h-14 rounded-xl bg-neutral-800 hover:bg-neutral-700 active:bg-amber-500 active:text-black border border-neutral-700 text-xl font-bold text-white transition"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={() => setPinInput((p) => p.slice(0, -1))}
                  className="h-14 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-[12px] font-bold text-neutral-400 transition"
                >
                  Del
                </button>
              </div>

              <div className="text-[11.5px] text-neutral-400 bg-neutral-800/80 p-3 rounded-xl text-left space-y-0.5">
                <span className="font-semibold text-neutral-300">Staff Authorization:</span>
                <div>Individual PINs are configured in Staff Management.</div>
                <div className="text-neutral-500 italic">Kitchen personnel operate via printed dockets.</div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowPinModal(false)}
                  className="flex-1 h-12 text-[13px] font-semibold bg-neutral-800 text-neutral-300 rounded-xl hover:bg-neutral-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 h-12 text-[13px] font-bold bg-amber-500 text-black rounded-xl hover:bg-amber-400 transition"
                >
                  Unlock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
