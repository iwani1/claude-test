"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { HoldToConfirmButton } from "@/components/interface-studies";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** True while the confirmed action is running — both buttons lock. */
  busy?: boolean;
  busyLabel?: string;
  /** Failure from the server, shown inside the dialog instead of vanishing. */
  error?: string;
  /**
   * Irreversible actions (permanent deletion) require a press-and-hold on
   * the confirm button instead of a single tap. Cancel stays a plain tap.
   * A type-to-confirm alternative is always offered alongside the hold —
   * a sustained press must never be the only way to activate a control.
   */
  holdToConfirm?: boolean;
  /** Word for the typed alternative to press-and-hold. Default "DELETE". */
  confirmWord?: string;
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
  busy = false,
  busyLabel = "Working…",
  error,
  holdToConfirm = false,
  confirmWord = "DELETE",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  // Typed alternative to press-and-hold (accessibility: a sustained press
  // must never be the only activation path). Reset whenever the dialog is
  // answered or dismissed so a typed word never carries to the next item.
  const [typedMode, setTypedMode] = useState(false);
  const [typedWord, setTypedWord] = useState("");
  if (!open) return null;
  const resetTyped = () => {
    setTypedMode(false);
    setTypedWord("");
  };
  const confirmAndReset = () => {
    resetTyped();
    onConfirm();
  };
  const typedMatches = typedWord.trim().toUpperCase() === confirmWord.toUpperCase();
  return (
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center p-5 bg-black/75 backdrop-blur-sm overflow-y-auto"
      role="alertdialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full max-w-lg bg-neutral-900 border border-neutral-700 rounded-3xl shadow-2xl max-h-[92dvh] overflow-y-auto my-auto">
        <div className="px-6 pt-7 pb-5 flex flex-col items-center text-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/15 border border-rose-500/40 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-rose-400" />
          </div>
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <p className="text-sm text-neutral-400 leading-relaxed">{message}</p>
          {error && <p className="text-sm font-semibold text-rose-400">{error}</p>}
        </div>
        <div className="px-5 pb-5 grid grid-cols-2 gap-3.5">
          <button
            onClick={() => {
              resetTyped();
              onCancel();
            }}
            disabled={busy}
            className="h-14 rounded-2xl bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-600 border border-neutral-700 text-white text-base font-bold transition active:scale-[0.98] disabled:opacity-40"
          >
            {cancelLabel}
          </button>
          {holdToConfirm && !busy ? (
            <HoldToConfirmButton
              label={confirmLabel}
              holdingLabel="Keep holding…"
              disabled={busy}
              onConfirm={confirmAndReset}
              className="h-14 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white text-base font-bold disabled:opacity-40"
            />
          ) : (
            <button
              onClick={onConfirm}
              disabled={busy}
              className="h-14 rounded-2xl bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white text-base font-bold transition active:scale-[0.98] disabled:opacity-40"
            >
              {busy ? busyLabel : confirmLabel}
            </button>
          )}
        </div>

        {/* Accessible alternative to press-and-hold: type the word. */}
        {holdToConfirm && !busy &&
          (!typedMode ? (
            <div className="px-5 pb-5">
              <button
                onClick={() => setTypedMode(true)}
                className="w-full py-1 text-center text-xs font-semibold text-neutral-400 underline decoration-dotted underline-offset-4 hover:text-neutral-200"
              >
                Can&apos;t press and hold? Type to confirm instead
              </button>
            </div>
          ) : (
            <div className="px-5 pb-5 space-y-2">
              <input
                value={typedWord}
                onChange={(e) => setTypedWord(e.target.value)}
                placeholder={`Type ${confirmWord} to confirm`}
                aria-label={`Type ${confirmWord} to confirm`}
                autoComplete="off"
                autoFocus
                className="w-full h-12 rounded-xl bg-neutral-800 border border-neutral-600 px-3 text-base font-bold uppercase tracking-widest text-white placeholder:normal-case placeholder:tracking-normal placeholder:font-medium focus:outline-none focus:border-rose-500"
              />
              <button
                onClick={confirmAndReset}
                disabled={!typedMatches}
                className="w-full h-12 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {confirmLabel}
              </button>
            </div>
          ))}
      </div>
    </div>
  );
}
