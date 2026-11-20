"use client";

import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, KeyRound, LogOut, Maximize, Moon, Sun, Type, Undo2 } from "lucide-react";
import { ROLE_PERMISSIONS, type UserRole } from "@/lib/permissions";
import { PinSwitchModal } from "@/components/PinSwitchModal";
import { DISPLAY_SIZE_LABEL, applyDisplaySize, readDisplaySize, type DisplaySize } from "@/components/DisplaySizeControl";
import { setUiDesign, setUiTheme, useUiPreferences } from "@/lib/ui-preferences";
import type { CurrentUser } from "@/lib/api-types";

const DISPLAY_SIZES: DisplaySize[] = ["standard", "large", "extra"];

/** Closes a popover on an outside tap or Escape. */
export function useDismiss(open: boolean, setOpen: (open: boolean) => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, setOpen]);
  return ref;
}

export const menuItemClass =
  "w-full min-h-11 px-3 rounded-lg flex items-center gap-2.5 text-left text-sm font-semibold text-ui-text hover:bg-ui-subtle transition";

/**
 * The new design's account menu (redesign stage 6b): the staff member's
 * initials open switch staff (PIN), text & touch size, light/dark, full
 * screen, back to the classic design, and sign out. Shared by the md+ top
 * bar and the phone top bar, so both offer the same things.
 */
export function AccountMenu({
  currentUser,
  onUserChange,
  onLogout,
  showName = false,
}: {
  currentUser: CurrentUser;
  onUserChange: (user: any) => void;
  onLogout?: () => void;
  /** md+ bar: show the name and role beside the initials (by container width). */
  showName?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [size, setSize] = useState<DisplaySize>("large");
  const ref = useDismiss(open, setOpen);
  const { theme } = useUiPreferences();
  const roleLabel = ROLE_PERMISSIONS[currentUser.role as UserRole]?.label || currentUser.role;
  const initials = (currentUser.name || "Staff")
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  useEffect(() => {
    // Read after mount: the pre-paint script already applied the size.
    const t = setTimeout(() => setSize(readDisplaySize()), 0);
    return () => clearTimeout(t);
  }, []);

  const cycleSize = () => {
    const next = DISPLAY_SIZES[(DISPLAY_SIZES.indexOf(size) + 1) % DISPLAY_SIZES.length];
    setSize(next);
    applyDisplaySize(next);
  };
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  };

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`${currentUser.name}, ${roleLabel}: account menu`}
        className="h-11 pl-1 pr-2 rounded-lg flex items-center gap-2 hover:bg-ui-subtle transition"
      >
        <span className="w-9 h-9 rounded-full bg-ui-primary-soft text-ui-primary-text text-[0.8125rem] font-bold flex items-center justify-center">
          {initials}
        </span>
        {showName && (
          <span className="hidden @[88rem]:flex flex-col items-start leading-tight">
            <span className="text-[0.8125rem] font-bold max-w-36 truncate">{currentUser.name}</span>
            <span className="text-xs text-ui-muted">{roleLabel}</span>
          </span>
        )}
        <ChevronDown className="w-4 h-4 text-ui-muted" />
      </button>
      {open && (
        <div
          role="menu"
          className="ui-in absolute right-0 top-full mt-2 z-50 w-72 max-w-[calc(100vw-1rem)] max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-xl border border-ui-border bg-ui-surface shadow-ui-2 p-2"
        >
          <div role="none" className="px-3 py-2 border-b border-ui-border mb-1">
            <div className="text-sm font-bold">{currentUser.name}</div>
            <div className="text-xs text-ui-muted">{roleLabel}</div>
          </div>
          <button type="button" role="menuitem" className={menuItemClass} onClick={() => { setOpen(false); setPinOpen(true); }}>
            <KeyRound className="w-[1.125rem] h-[1.125rem] text-ui-muted" /> Switch staff
          </button>
          <button type="button" role="menuitem" className={menuItemClass} onClick={cycleSize}>
            <Type className="w-[1.125rem] h-[1.125rem] text-ui-muted" />
            <span className="flex-1">Text &amp; touch size</span>
            <span className="text-xs text-ui-muted">{DISPLAY_SIZE_LABEL[size]}</span>
          </button>
          <div role="none" aria-hidden="true" className="px-3 pt-2 pb-1 text-[0.6875rem] font-bold tracking-[0.08em] text-ui-muted">THEME</div>
          <div role="group" aria-label="Theme" className="grid grid-cols-2 gap-1 px-1 pb-1">
            {([
              ["light", "Light", Sun],
              ["dark", "Dark", Moon],
            ] as const).map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                role="menuitemradio"
                aria-checked={theme === value}
                onClick={() => setUiTheme(value)}
                className={`h-11 rounded-lg flex items-center justify-center gap-2 text-sm font-semibold border transition ${
                  theme === value ? "border-ui-primary bg-ui-primary-soft text-ui-primary-text" : "border-ui-border text-ui-text-2 hover:bg-ui-subtle"
                }`}
              >
                <Icon className="w-4 h-4" /> {label}
              </button>
            ))}
          </div>
          <button type="button" role="menuitem" className={menuItemClass} onClick={toggleFullscreen}>
            <Maximize className="w-[1.125rem] h-[1.125rem] text-ui-muted" /> Full screen
          </button>
          <button type="button" role="menuitem" className={menuItemClass} onClick={() => setUiDesign("classic")}>
            <Undo2 className="w-[1.125rem] h-[1.125rem] text-ui-muted" /> Back to the classic design
          </button>
          <div role="none" className="border-t border-ui-border mt-1 pt-1">
            <button type="button" role="menuitem" className={`${menuItemClass} text-ui-danger`} onClick={onLogout}>
              <LogOut className="w-[1.125rem] h-[1.125rem]" /> Sign out
            </button>
          </div>
        </div>
      )}
      <PinSwitchModal open={pinOpen} onClose={() => setPinOpen(false)} onUserChange={onUserChange} />
    </div>
  );
}
