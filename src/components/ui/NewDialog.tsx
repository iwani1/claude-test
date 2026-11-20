"use client";

import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";

/**
 * The new design's pop-up frame and control styles (redesign, Nov 2026),
 * shared by every new-design dialog so they look and behave alike:
 * overlay, focus moved into the dialog, Escape to close, and 44px+ targets.
 */
export function Dialog({
  label,
  onClose,
  width = "max-w-lg",
  children,
}: {
  label: string;
  onClose: () => void;
  width?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto">
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={`w-full ${width} my-auto rounded-2xl bg-ui-surface text-ui-text border border-ui-border shadow-2xl outline-none max-h-[94dvh] overflow-y-auto`}
      >
        {children}
      </div>
    </div>
  );
}

export function CloseButton({ onClick, label = "Close" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="w-11 h-11 rounded-full text-ui-muted hover:text-ui-text hover:bg-ui-subtle flex items-center justify-center shrink-0"
    >
      <X className="w-5 h-5" />
    </button>
  );
}

/** Title row: icon, heading, optional sub-line, close button. */
export function DialogHeader({
  icon,
  title,
  sub,
  onClose,
  tone = "primary",
}: {
  icon?: React.ReactNode;
  title: string;
  sub?: React.ReactNode;
  onClose: () => void;
  tone?: "primary" | "danger" | "info" | "success";
}) {
  const toneCls = {
    primary: "bg-ui-primary-soft text-ui-primary-text",
    danger: "bg-ui-danger-soft text-ui-danger",
    info: "bg-ui-info-soft text-ui-info",
    success: "bg-ui-success-soft text-ui-success",
  }[tone];
  return (
    <div className="flex items-start gap-3">
      {icon && <span className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${toneCls}`}>{icon}</span>}
      <div className="flex-1 min-w-0">
        <h3 className="text-lg font-bold leading-tight">{title}</h3>
        {sub && <div className="text-sm text-ui-muted mt-0.5">{sub}</div>}
      </div>
      <CloseButton onClick={onClose} />
    </div>
  );
}

export const tile = (on: boolean) =>
  `rounded-xl border-2 transition text-left ${
    on ? "border-ui-primary bg-ui-primary-soft text-ui-primary-text" : "border-ui-border bg-ui-surface text-ui-text hover:border-ui-border-strong"
  }`;
export const fieldCls =
  "w-full h-12 rounded-lg border border-ui-border-strong bg-ui-surface px-3 text-ui-text placeholder:text-ui-muted focus:outline-none focus:border-ui-primary disabled:opacity-60";
export const labelCls = "block text-sm font-bold mb-1";
export const btnSecondary =
  "h-12 px-4 rounded-lg border border-ui-border-strong bg-ui-surface text-ui-text text-sm font-semibold hover:bg-ui-subtle transition disabled:opacity-40";
export const btnPrimary =
  "h-12 px-5 rounded-lg bg-ui-primary hover:bg-ui-primary-hover text-ui-on-primary text-sm font-bold transition disabled:opacity-40 disabled:cursor-not-allowed";
/** Filled red: in light it is #b91c1c with white text; in dark the light red
 *  token with the dark surface colour as text. Both pass 4.5:1. */
export const btnDanger =
  "h-12 px-5 rounded-lg bg-ui-danger text-ui-surface text-sm font-bold transition hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed";
