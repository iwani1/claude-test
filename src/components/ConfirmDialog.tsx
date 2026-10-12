"use client";

import { AlertTriangle } from "lucide-react";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * One question, two big buttons — the safety net for anything that destroys
 * work or money. A finger at busy-bar speed eventually lands on the wrong
 * control, so destructive actions ask first. Both choices are 56px tall and
 * well apart; the safe choice (cancel) sits on the left, under the thumb.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Yes, continue",
  cancelLabel = "Go back",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-5 bg-black/75 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full max-w-lg bg-neutral-900 border border-neutral-700 rounded-3xl shadow-2xl">
        <div className="px-6 pt-7 pb-5 flex flex-col items-center text-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/15 border border-rose-500/40 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-rose-400" />
          </div>
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <p className="text-sm text-neutral-400 leading-relaxed">{message}</p>
        </div>
        <div className="px-5 pb-5 grid grid-cols-2 gap-3.5">
          <button
            onClick={onCancel}
            className="h-14 rounded-2xl bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-600 border border-neutral-700 text-white text-base font-bold transition active:scale-[0.98]"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="h-14 rounded-2xl bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white text-base font-bold transition active:scale-[0.98]"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
