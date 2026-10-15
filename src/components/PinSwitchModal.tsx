"use client";

import React, { useState } from "react";
import { KeyRound } from "lucide-react";
import { apiErrorMessage, apiFetch } from "@/lib/api-client";

/**
 * Fast staff switch by 4-digit PIN. Shared by the phone top bar and the
 * desktop/tablet rail, which both offer "Switch Staff" — one implementation
 * so the two can never drift apart.
 */
export const PinSwitchModal: React.FC<{
  open: boolean;
  onClose: () => void;
  onUserChange: (user: any) => void;
}> = ({ open, onClose, onUserChange }) => {
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");

  if (!open) return null;

  const close = () => {
    setPinInput("");
    setPinError("");
    onClose();
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError("");
    try {
      const data = await apiFetch("/api/auth/switch-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pinInput }),
      });
      if (data.success && data.user) {
        onUserChange(data.user);
        close();
      } else {
        setPinError(data.error || "Invalid PIN code");
      }
    } catch (e) {
      setPinError(apiErrorMessage(e, "Failed to authenticate PIN"));
    }
  };

  return (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center max-h-[92dvh] overflow-y-auto my-auto">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto mb-3">
              <KeyRound className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Enter Employee PIN</h3>
            <p className="text-[0.8125rem] text-neutral-400 mb-5">
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

              {pinError && <p className="text-[0.8125rem] text-rose-400">{pinError}</p>}

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
                  className="h-14 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-[0.75rem] font-bold text-neutral-400 transition"
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
                  className="h-14 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-[0.75rem] font-bold text-neutral-400 transition"
                >
                  Del
                </button>
              </div>

              <div className="text-[0.71875rem] text-neutral-400 bg-neutral-800/80 p-3 rounded-xl text-left space-y-0.5">
                <span className="font-semibold text-neutral-300">Staff Authorization:</span>
                <div>Individual PINs are configured in Staff Management.</div>
                <div className="text-neutral-500 italic">Kitchen personnel operate via printed dockets.</div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={close}
                  className="flex-1 h-12 text-[0.8125rem] font-semibold bg-neutral-800 text-neutral-300 rounded-xl hover:bg-neutral-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 h-12 text-[0.8125rem] font-bold bg-amber-500 text-black rounded-xl hover:bg-amber-400 transition"
                >
                  Unlock
                </button>
              </div>
            </form>
          </div>
        </div>
  );
};
