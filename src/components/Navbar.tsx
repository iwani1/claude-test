"use client";
import { useOnlineStatus, useOfflineQueueCount } from "@/lib/use-terminal-status";

import React, { useState, useEffect } from "react";
import {
  Menu,
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
} from "lucide-react";
import { ROLE_PERMISSIONS, UserRole, hasTerminalAccess } from "@/lib/permissions";
import { getOfflineQueue, syncOfflineQueueToServer } from "@/lib/offline-storage";
import { DisplaySizeControl } from "@/components/DisplaySizeControl";
import { PinSwitchModal } from "@/components/PinSwitchModal";
import { notify } from "@/lib/notify";
import type { CurrentUser } from "@/lib/api-types";

interface NavbarProps {
  currentUser: CurrentUser;
  onUserChange: (user: any) => void;
  lowStockCount?: number;
  openShift?: any;
  onLogout?: () => void;
  /** Phones only: opens the slide-in navigation drawer. */
  onOpenMenu?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  onUserChange,
  lowStockCount = 0,
  openShift,
  onLogout,
  onOpenMenu,
}) => {
  const isOnline = useOnlineStatus();
  const offlineCount = useOfflineQueueCount(currentUser.branchId);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);

  const handleManualSync = async () => {
    setIsSyncing(true);
    const res = await syncOfflineQueueToServer(currentUser.branchId);
    setIsSyncing(false);
    if (res.success && res.count > 0) {
      notify(`Sent ${res.count} offline order${res.count === 1 ? "" : "s"} to the server. Collect any payments that were taken on paper.`, "ok");
    } else if (!res.success) {
      notify(res.error ? `Sync failed: ${res.error} — the offline orders are still on this device.` : "Could not reach the server — the offline orders are still on this device.", "error");
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

  const currentRoleInfo = currentUser?.role
    ? ROLE_PERMISSIONS[currentUser.role as UserRole]
    : null;

  // Only roles permitted to open a session are offered for switching.
  // Kitchen staff have no terminal access, so they are never listed.
  const switchableRoles = (Object.keys(ROLE_PERMISSIONS) as UserRole[]).filter((r) =>
    hasTerminalAccess(r)
  );




  return (
    <>
      {/* 72px bar keeps every control above comfortable finger size */}
      <header className="h-[72px] bg-neutral-900 border-b border-neutral-800 text-white flex items-center justify-between px-2 sm:px-4 lg:px-5 select-none shrink-0 z-40">
        {/* Left: drawer trigger (phones), brand & branch context */}
        <div className="flex items-center gap-2 sm:gap-3.5 flex-1 min-w-0">
          {onOpenMenu && (
            <button
              onClick={onOpenMenu}
              className="md:hidden h-11 w-11 shrink-0 rounded-xl bg-neutral-800 hover:bg-neutral-750 active:bg-neutral-700 border border-neutral-700 text-neutral-200 flex items-center justify-center transition"
              aria-label="Open navigation menu"
            >
              <Menu className="w-6 h-6" />
            </button>
          )}
          {/* Phone brand cluster (mobile redesign "Twin", Oct 2026): the Demo A
              top bar carries the hotel identity on phones too. Mark always,
              name + staff line only from 430px up — below that the bar cannot
              hold branding AND every control, so the name yields (it still
              appears in the drawer and on the sign-in screen). Desktop and
              tablet bars are untouched: this cluster is sm:hidden. */}
          <div className="flex sm:hidden items-center gap-2 min-w-0 shrink-0">
            <div className="w-9 h-9 rounded-[0.625rem] bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/20 shrink-0">
              <Store className="w-5 h-5 text-white" />
            </div>
            <div className="hidden min-[430px]:block min-w-0">
              <div className="text-[0.8125rem] font-bold tracking-tight text-neutral-100 truncate leading-tight">
                Lush View Hotel
              </div>
              <div className="text-[0.625rem] text-neutral-400 truncate leading-tight">
                {currentRoleInfo?.label || currentUser?.role || "Staff"} · {currentUser?.name || "Staff"}
              </div>
            </div>
          </div>
          {/* The mark yields to the controls on phones: at the largest display
              size a 320px-wide bar cannot hold branding *and* every control.
              The brand still appears in the drawer and on the sign-in screen. */}
          <div className="hidden sm:flex w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 items-center justify-center shadow-lg shadow-orange-500/20 shrink-0">
            <Store className="w-6 h-6 text-white" />
          </div>
          <div className="min-w-0 hidden sm:block">
            <div className="flex items-center gap-2">
              <span className="font-bold text-[0.9375rem] tracking-tight text-neutral-100 truncate">
                Lush View Hotel
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[0.75rem] text-neutral-400">
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
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Per-terminal text & touch size — each screen can differ. */}
          <DisplaySizeControl />
          {/* Register state — the brand block that carries it is hidden on
              phones, and whether the drawer is open is the one thing a cashier
              must never have to guess. */}
          <div
            className={`md:hidden flex items-center gap-1.5 px-2 h-11 rounded-xl border text-[0.75rem] font-medium ${
              openShift
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-amber-500/10 border-amber-500/30 text-amber-400"
            }`}
            title={openShift ? "Your shift is open" : "Your shift is closed"}
          >
            <span className={`w-2 h-2 rounded-full ${openShift ? "bg-emerald-400" : "bg-amber-400"}`} />
            {/* Shifts are per-staff: this chip is about YOUR shift, not the till's. */}
            <span className="hidden sm:inline">{openShift ? "My shift: Open" : "My shift: Closed"}</span>
          </div>

          {/* Network status — only shown when it matters: a phone's top bar has
              no room for a permanent "online" badge. */}
          <div
            className={`${
              isOnline && offlineCount === 0 ? "hidden sm:flex" : "flex"
            } items-center gap-1.5 px-2 sm:px-3 h-11 rounded-xl bg-neutral-800/80 border border-neutral-700/60 text-[0.75rem]`}
          >
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
                className="ml-1 px-2.5 h-7 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 rounded-lg text-[0.6875rem] font-bold flex items-center gap-1.5 transition"
                title="Sync offline queue"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                <span>{offlineCount}</span>
              </button>
            )}
          </div>

          {/* Low stock alerts badge */}
          {lowStockCount > 0 && (
            <div className="hidden xl:flex items-center gap-1.5 px-3 h-11 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[0.75rem] font-semibold">
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
            className="h-11 px-2.5 sm:px-3.5 text-neutral-200 hover:text-white hover:bg-neutral-800 rounded-xl border border-neutral-700/60 flex items-center gap-2 text-[0.75rem] font-semibold transition active:bg-neutral-750"
            title="Switch employee with PIN"
          >
            <KeyRound className="w-5 h-5 text-amber-400" />
            <span className="hidden xl:inline">Switch Staff</span>
          </button>

          {/* User profile & Role switcher */}
          <div className="relative">
            <button
              onClick={() => setShowRoleDropdown(!showRoleDropdown)}
              className="flex items-center gap-2.5 h-11 pl-1.5 pr-2 sm:pl-2 sm:pr-3 rounded-xl bg-neutral-800 hover:bg-neutral-750 border border-neutral-700 transition active:bg-neutral-750"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-600 to-orange-500 flex items-center justify-center text-[0.8125rem] font-bold text-white shadow-xs">
                {currentUser?.name ? currentUser.name.charAt(0) : "U"}
              </div>
              <div className="text-left hidden md:block max-w-[150px]">
                <div className="text-[0.78125rem] font-semibold leading-tight text-neutral-100 truncate">
                  {currentUser?.name || "Staff"}
                </div>
                <div className="text-[0.65625rem] text-amber-400 font-medium truncate">
                  {currentRoleInfo?.label || currentUser?.role || "Staff"}
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-neutral-400 shrink-0 hidden sm:block" />
            </button>

            {/* User Profile dropdown */}
            {showRoleDropdown && (
              <>
                <div
                  className="items-start justify-center fixed inset-0 z-40 overflow-y-auto"
                  onClick={() => setShowRoleDropdown(false)}
                />
                <div className="absolute right-0 mt-2 w-[280px] max-w-[calc(100vw-1rem)] bg-neutral-800 border border-neutral-700 rounded-2xl shadow-2xl py-2 z-50">
                  <div className="px-4 py-2.5 border-b border-neutral-700/80">
                    <div className="text-sm font-bold text-white truncate">
                      {currentUser?.name || "Active Staff"}
                    </div>
                    <div className="text-xs text-amber-400 font-semibold mt-0.5">
                      {currentRoleInfo?.label || currentUser?.role}
                    </div>
                    {currentUser?.email && (
                      <div className="text-[0.6875rem] text-neutral-400 truncate mt-0.5 font-mono">
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
                      className="w-full text-left px-4 py-2.5 text-[0.8125rem] font-medium text-neutral-200 hover:bg-neutral-700/60 flex items-center gap-2.5 transition"
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
                      className="w-full text-left px-4 py-2.5 text-[0.8125rem] font-semibold text-rose-400 hover:bg-rose-500/10 flex items-center gap-2.5 transition"
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

      <PinSwitchModal
        open={showPinModal}
        onClose={() => setShowPinModal(false)}
        onUserChange={onUserChange}
      />
    </>
  );
};
