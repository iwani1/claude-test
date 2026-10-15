"use client";

import React, { useState } from "react";
import {
  KeyRound,
  LogOut,
  Maximize,
  Wifi,
  WifiOff,
  ShieldAlert,
  RefreshCw,
} from "lucide-react";
import { ROLE_PERMISSIONS } from "@/lib/permissions";
import { useOnlineStatus, useOfflineQueueCount } from "@/lib/use-terminal-status";
import { syncOfflineQueueToServer } from "@/lib/offline-storage";
import { DisplaySizeControl } from "@/components/DisplaySizeControl";
import { PinSwitchModal } from "@/components/PinSwitchModal";
import { notify } from "@/lib/notify";
import type { CurrentUser } from "@/lib/api-types";

/**
 * Slim top strip for md+ screens: signed-in user, Switch Staff, display
 * size, online/offline state (+ offline-queue sync), fullscreen and the
 * low-stock alert. These controls have lived in the top bar, then the
 * rail, then a full-width strip; staff asked for everything grouped on
 * the left, above the menu column only (Oct 2026), so the POS bill
 * panel can extend to the very top of the screen. On other screens the
 * shell renders it across the top of the work area. Phones keep the
 * Navbar instead (this strip is max-md:hidden).
 */
export const TerminalControls: React.FC<{
  currentUser: CurrentUser;
  lowStockCount?: number;
  onUserChange: (user: any) => void;
  onLogout?: () => void;
}> = ({ currentUser, lowStockCount = 0, onUserChange, onLogout }) => {
  const isOnline = useOnlineStatus();
  const offlineCount = useOfflineQueueCount(currentUser.branchId);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const roleLabel =
    ROLE_PERMISSIONS[currentUser.role as keyof typeof ROLE_PERMISSIONS]?.label ||
    currentUser.role;

  const handleManualSync = async () => {
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

  return (
    <div className="max-md:hidden shrink-0 h-14 bg-neutral-900 border-b border-neutral-800 flex items-center gap-2 px-3 select-none overflow-x-auto custom-scrollbar">
      {/* Signed-in user + fast staff switch */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-amber-600 to-orange-500 flex items-center justify-center text-sm font-bold text-white shadow-xs shrink-0">
          {currentUser.name ? currentUser.name.charAt(0) : "U"}
        </div>
        <div className="text-left min-w-0 hidden sm:block">
          <div className="text-[0.8125rem] font-semibold leading-tight text-neutral-100 truncate">
            {currentUser.name || "Staff"}
          </div>
          <div className="text-[0.65625rem] text-amber-400 font-medium truncate">
            {roleLabel}
          </div>
        </div>
        <button
          onClick={() => setShowPinModal(true)}
          className="h-11 px-3 ml-1 text-neutral-200 hover:text-white hover:bg-neutral-800 rounded-xl border border-neutral-700/60 flex items-center gap-2 text-[0.75rem] font-semibold transition active:bg-neutral-750"
          title="Switch employee with PIN"
        >
          <KeyRound className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="hidden lg:inline">Switch Staff</span>
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

      {/* Terminal state + controls — grouped with the user block on the
          left at staff request; nothing sits on the right any more. */}
      {lowStockCount > 0 && (
        <div className="hidden xl:flex items-center gap-1.5 px-3 h-11 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[0.75rem] font-semibold">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>{lowStockCount} low stock</span>
        </div>
      )}
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
        <span className="font-medium hidden sm:inline">{isOnline ? "Online" : "Offline"}</span>
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

      <PinSwitchModal
        open={showPinModal}
        onClose={() => setShowPinModal(false)}
        onUserChange={onUserChange}
      />
    </div>
  );
};
