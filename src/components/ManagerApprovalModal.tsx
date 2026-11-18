"use client";

import React, { useCallback, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";

/** The server's answer when an action needs a manager's PIN (src/lib/manager-approval.ts). */
export const APPROVAL_CODES = ["manager_approval_required", "manager_approval_invalid"];

/**
 * Asks for a manager's PIN at the till, for actions the server will not take on a
 * cashier's word alone: removing items from, or cancelling, an order the kitchen
 * already has. Usage:
 *
 *   const { requestManagerPin, approvalModal } = useManagerApproval();
 *   const pin = await requestManagerPin("Removing items needs a manager's PIN.");
 *   // pin === null when the cashier cancelled
 *
 * and render {approvalModal} once.
 */
export function useManagerApproval() {
  const [prompt, setPrompt] = useState<{ message: string; error?: string } | null>(null);
  const resolver = useRef<((pin: string | null) => void) | null>(null);

  const requestManagerPin = useCallback((message: string, error?: string) => new Promise<string | null>((resolve) => {
    resolver.current = resolve;
    setPrompt({ message, error });
  }), []);

  const finish = (pin: string | null) => {
    resolver.current?.(pin);
    resolver.current = null;
    setPrompt(null);
  };

  const approvalModal = prompt ? (
    <ManagerApprovalModal message={prompt.message} error={prompt.error} onSubmit={(pin) => finish(pin)} onCancel={() => finish(null)} />
  ) : null;

  return { requestManagerPin, approvalModal };
}

const ManagerApprovalModal: React.FC<{
  message: string;
  error?: string;
  onSubmit: (pin: string) => void;
  onCancel: () => void;
}> = ({ message, error, onSubmit, onCancel }) => {
  const [pin, setPin] = useState("");
  const add = (d: string) => setPin((p) => (p.length < 8 ? p + d : p));

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="manager-approval-title" className="fixed inset-0 z-[60] flex items-start justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center max-h-[92dvh] overflow-y-auto my-auto">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto mb-3">
          <ShieldCheck className="w-7 h-7" />
        </div>
        <h3 id="manager-approval-title" className="text-lg font-bold text-white mb-1">Manager approval</h3>
        <p className="text-[0.8125rem] text-neutral-400 mb-5">{message}</p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (pin.length >= 6) onSubmit(pin);
          }}
          className="space-y-4"
        >
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={8}
            autoFocus
            aria-label="Manager PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
            placeholder="••••"
            className="w-full text-center text-4xl tracking-[0.3em] font-mono py-3 bg-neutral-800 border border-neutral-700 rounded-2xl text-white focus:outline-none focus:border-amber-500"
          />

          {error && <p className="text-[0.8125rem] text-rose-400">{error}</p>}

          <div className="grid grid-cols-3 gap-2">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
              <button key={d} type="button" onClick={() => add(d)}
                className="h-14 rounded-xl bg-neutral-800 hover:bg-neutral-700 active:bg-amber-500 active:text-black border border-neutral-700 text-xl font-bold text-white transition">
                {d}
              </button>
            ))}
            <button type="button" onClick={() => setPin("")}
              className="h-14 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-[0.75rem] font-bold text-neutral-400 transition">
              Clear
            </button>
            <button type="button" onClick={() => add("0")}
              className="h-14 rounded-xl bg-neutral-800 hover:bg-neutral-700 active:bg-amber-500 active:text-black border border-neutral-700 text-xl font-bold text-white transition">
              0
            </button>
            <button type="button" onClick={() => setPin((p) => p.slice(0, -1))}
              className="h-14 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-[0.75rem] font-bold text-neutral-400 transition">
              Del
            </button>
          </div>

          <p className="text-[0.71875rem] text-neutral-400 bg-neutral-800/80 p-3 rounded-xl text-left">
            The manager types their own 6- to 8-digit PIN. Their name is recorded in the activity log with this change.
          </p>

          <div className="flex gap-2">
            <button type="button" onClick={onCancel}
              className="flex-1 h-12 text-[0.8125rem] font-semibold bg-neutral-800 text-neutral-300 rounded-xl hover:bg-neutral-700 transition">
              Cancel
            </button>
            <button type="submit" disabled={pin.length < 6}
              className="flex-1 h-12 text-[0.8125rem] font-bold bg-amber-500 text-black rounded-xl hover:bg-amber-400 disabled:opacity-50 transition">
              Approve
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
