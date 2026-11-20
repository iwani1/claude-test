"use client";

import Image from "next/image";
import React, { useState } from "react";
import { KeyRound, Menu, RefreshCw, WifiOff } from "lucide-react";
import { AccountMenu } from "@/components/AccountMenu";
import { PinSwitchModal } from "@/components/PinSwitchModal";
import { syncOfflineQueueToServer } from "@/lib/offline-storage";
import { useOfflineQueueCount, useOnlineStatus } from "@/lib/use-terminal-status";
import { notify } from "@/lib/notify";
import type { CurrentUser } from "@/lib/api-types";

/**
 * The phone top bar in the new design (redesign stage 6b): menu, the hotel's
 * mark with the staff member's shift state, an offline/sync chip only while
 * it matters, a quick Switch staff, and the shared account menu (text size,
 * light/dark, back to classic, sign out). Replaces the classic Navbar on
 * phones while the new design is on; same actions, same offline sync.
 */
export function PhoneTopBar({
  currentUser,
  onUserChange,
  onLogout,
  onOpenMenu,
  shiftOpen,
}: {
  currentUser: CurrentUser;
  onUserChange: (user: any) => void;
  onLogout?: () => void;
  onOpenMenu: () => void;
  shiftOpen: boolean;
}) {
  const isOnline = useOnlineStatus();
  const queued = useOfflineQueueCount(currentUser.branchId);
  const [syncing, setSyncing] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);

  const sync = async () => {
    setSyncing(true);
    const res = await syncOfflineQueueToServer(currentUser.branchId);
    setSyncing(false);
    if (res.success && res.count > 0) {
      notify(`Sent ${res.count} offline order${res.count === 1 ? "" : "s"} to the server. Collect any payments that were taken on paper.`, "ok");
    } else if (!res.success) {
      notify(res.error ? `Sync failed: ${res.error} — the offline orders are still on this device.` : "Could not reach the server — the offline orders are still on this device.", "error");
    } else {
      notify("Nothing waiting to sync.", "ok");
    }
  };

  return (
    <header className="@container h-16 shrink-0 z-40 bg-ui-surface border-b border-ui-border text-ui-text flex items-center gap-2 px-2 select-none">
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Open navigation menu"
        className="w-11 h-11 rounded-lg text-ui-text-2 hover:bg-ui-subtle flex items-center justify-center shrink-0"
      >
        <Menu className="w-6 h-6" />
      </button>

      <div className="flex items-center gap-2 min-w-0 flex-1">
        <Image unoptimized src="/logo.svg" alt="" width={36} height={36} className="w-9 h-9 rounded-[0.625rem] shadow-ui-1 shrink-0" priority />
        <div className="min-w-0 leading-tight">
          <div className="hidden @[22rem]:block text-[0.875rem] font-extrabold tracking-tight truncate">Lush View</div>
          {/* Shifts are per staff: this is about the signed-in person's shift. */}
          <div className={`text-xs font-semibold inline-flex items-center gap-1.5 ${shiftOpen ? "text-ui-success" : "text-ui-primary-text"}`}>
            <span className={`w-2 h-2 rounded-full shrink-0 ${shiftOpen ? "bg-ui-success" : "bg-ui-primary"}`} aria-hidden="true" />
            <span className="truncate">{shiftOpen ? "Shift open" : "Shift closed"}</span>
          </div>
        </div>
      </div>

      {queued > 0 ? (
        <button
          type="button"
          onClick={sync}
          disabled={syncing}
          aria-label={`${isOnline ? "" : "Offline. "}Sync ${queued} offline order${queued === 1 ? "" : "s"}`}
          className="h-11 px-2.5 rounded-lg bg-ui-primary-soft text-ui-primary-text text-xs font-bold inline-flex items-center gap-1.5 shrink-0"
        >
          {!isOnline && <WifiOff className="w-4 h-4" />}
          <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} /> {queued}
        </button>
      ) : (
        !isOnline && (
          <span role="status" className="h-11 px-2.5 rounded-lg bg-ui-primary-soft text-ui-primary-text text-xs font-bold inline-flex items-center gap-1.5 shrink-0">
            <WifiOff className="w-4 h-4" /> <span className="hidden @[24rem]:inline">Offline</span>
            <span className="sr-only @[24rem]:hidden">Offline</span>
          </span>
        )
      )}

      <button
        type="button"
        onClick={() => setPinOpen(true)}
        aria-label="Switch staff with PIN"
        className="w-11 h-11 rounded-lg text-ui-text-2 hover:bg-ui-subtle flex items-center justify-center shrink-0"
      >
        <KeyRound className="w-5 h-5" />
      </button>
      <AccountMenu currentUser={currentUser} onUserChange={onUserChange} onLogout={onLogout} />
      <PinSwitchModal open={pinOpen} onClose={() => setPinOpen(false)} onUserChange={onUserChange} />
    </header>
  );
}
