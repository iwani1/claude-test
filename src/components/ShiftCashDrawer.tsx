"use client";

import { LoadFailure } from "./LoadFailure";

import React, { useState, useEffect, useCallback } from "react";
import {
  Coins,
  DollarSign,
  Lock,
  Unlock,
  AlertCircle,
  ArrowDownRight,
  Receipt,
  CheckCircle2,
  Calendar,
  X,
  CreditCard,
  Banknote,
} from "lucide-react";

export const ShiftCashDrawer: React.FC<{ currentUser: any }> = ({ currentUser }) => {
  const [activeShift, setActiveShift] = useState<any | null>(null);
  const [shiftHistory, setShiftHistory] = useState<any[]>([]);

  // Modals
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showPayoutModal, setShowPayoutModal] = useState(false);

  // Form states
  const [openingCashInput, setOpeningCashInput] = useState("1200.00");
  const [openNotes, setOpenNotes] = useState("");
  const [countedCashInput, setCountedCashInput] = useState("");
  const [closeNotes, setCloseNotes] = useState("");
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutReason, setPayoutReason] = useState("");
  const [drawerMessage, setDrawerMessage] = useState<string | null>(null);

  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchShifts = useCallback(() => fetch("/api/shifts")
    .then(res => { if (!res.ok) throw new Error("Request failed"); return res.json(); })
    .then(data => {
    setLoadError(null);
      setActiveShift(data.activeShift);
      setShiftHistory(data.history || []);

    }).catch(() => setLoadError("Drawer and shifts could not be loaded. What is shown may be out of date.")), []);

  useEffect(() => {
    fetchShifts();
  }, [fetchShifts]);

  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "open_shift",
          userId: currentUser?.id || 1,
          openingCash: openingCashInput,
          notes: openNotes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowOpenModal(false);
        fetchShifts();
      } else {
        alert(data.error || "Failed to open shift");
      }
    } catch {
      alert("Error opening shift");
    }
  };

  const handleRecordPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift) return;
    try {
      const res = await fetch("/api/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cash_payout",
          shiftId: activeShift.id,
          amount: payoutAmount,
          reason: payoutReason,
          userId: currentUser?.id || 1,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowPayoutModal(false);
        setPayoutAmount("");
        setPayoutReason("");
        fetchShifts();
      } else {
        alert(data.error || "Payout was not recorded");
      }
    } catch {
      alert("Error recording payout");
    }
  };

  const handleOpenDrawer = async () => {
    if (!activeShift) {
      alert("Open a shift first — the drawer stays locked while the register is closed.");
      return;
    }
    try {
      const res = await fetch("/api/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "open_drawer", shiftId: activeShift.id, reason: "No-sale drawer open from till" }),
      });
      const data = await res.json();
      if (data.success) {
        setDrawerMessage(data.message || "Drawer-open request logged.");
        setTimeout(() => setDrawerMessage(null), 4000);
      } else {
        alert(data.error || "Could not open drawer");
      }
    } catch {
      alert("Could not reach the drawer service");
    }
  };

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift) return;
    try {
      const res = await fetch("/api/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "close_shift",
          shiftId: activeShift.id,
          actualClosingCash: countedCashInput,
          notes: closeNotes,
          reconciledBy: currentUser?.id || 1,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`Shift closed and reconciled! Variance: GH₵${data.difference}`);
        setShowCloseModal(false);
        setCountedCashInput("");
        setCloseNotes("");
        fetchShifts();
      } else {
        alert(data.error || "Shift was not closed");
      }
    } catch {
      alert("Error closing shift");
    }
  };

  const openingFloat = Number(activeShift?.openingCash || 0);
  const cashSales = Number(activeShift?.totalCashSales || 0);
  const cardSales = Number(activeShift?.totalCardSales || 0);
  const payouts = Number(activeShift?.cashPayouts || 0);
  const expectedInDrawer = openingFloat + cashSales - payouts;
  const counted = Number(countedCashInput || 0);
  const variance = counted - expectedInDrawer;

  return (
    <div className="flex-1 flex flex-col h-full bg-neutral-950 overflow-hidden">
      <LoadFailure message={loadError} onRetry={fetchShifts} />
      {/* Header */}
      <div className="p-4 bg-neutral-900 border-b border-neutral-800 flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Coins className="w-5 h-5 text-amber-500" />
            <span>Shift Operations & Cash Drawer Reconciliation</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Register cash balance tracking, cash drops, and end-of-shift audits in Ghanaian Cedis (GH₵)
          </p>
        </div>

        {activeShift ? (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleOpenDrawer}
              className="h-12 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl text-[0.8125rem] shadow-md flex items-center gap-2 transition active:scale-[0.97]"
              title="Pop the cash drawer open without a sale"
            >
              <Banknote className="w-5 h-5" />
              <span>Open Drawer</span>
            </button>
            <button
              onClick={() => setShowPayoutModal(true)}
              className="h-12 px-4 bg-neutral-800 hover:bg-neutral-750 text-neutral-200 font-semibold rounded-2xl text-[0.8125rem] border border-neutral-700 flex items-center gap-1.5 transition"
            >
              <ArrowDownRight className="w-4 h-4 text-rose-400" />
              <span>Cash Drop / Payout</span>
            </button>
            <button
              onClick={() => {
                setCountedCashInput(expectedInDrawer.toFixed(2));
                setShowCloseModal(true);
              }}
              className="h-12 px-4 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-2xl text-[0.8125rem] shadow-md shadow-rose-600/20 flex items-center gap-1.5 transition"
            >
              <Lock className="w-4 h-4" />
              <span>Close Shift</span>
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowOpenModal(true)}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl text-xs shadow-md shadow-amber-500/20 flex items-center gap-1.5 transition"
          >
            <Unlock className="w-4 h-4" />
            <span>Open Register Shift</span>
          </button>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">
        {drawerMessage && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-sm font-semibold">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>{drawerMessage}</span>
          </div>
        )}
        {/* Active Shift Card */}
        {activeShift ? (
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[0.625rem] font-bold uppercase tracking-wider border border-emerald-500/40">
                  Register #1 Currently Open
                </span>
                <h3 className="text-base font-bold text-white mt-1.5">
                  Shift #{activeShift.id} - Cashier: {activeShift.userName || "Akosua Serwaa"}
                </h3>
                <p className="text-xs text-neutral-400">
                  Opened: {new Date(activeShift.openedAt).toLocaleString()}
                </p>
              </div>

              <div className="text-right">
                <span className="text-[0.625rem] text-neutral-500 block uppercase font-bold">
                  Expected Drawer Cash
                </span>
                <span className="text-xl font-mono font-bold text-amber-400">
                  GH₵{expectedInDrawer.toFixed(2)}
                </span>
              </div>
            </div>

            <p className="text-xs text-neutral-400">Cash refunds included in outflows: GH₵{Number(activeShift.cashRefunds || 0).toFixed(2)}. Refunds are recorded automatically; use manual payouts only for other cash outflows.</p>
            {/* Metrics Breakdown Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="bg-neutral-850 p-3 rounded-xl border border-neutral-800 text-xs">
                <span className="text-neutral-400 block text-[0.625rem] uppercase font-semibold">
                  Starting Float
                </span>
                <span className="text-white font-mono font-bold text-sm">
                  GH₵{openingFloat.toFixed(2)}
                </span>
              </div>

              <div className="bg-neutral-850 p-3 rounded-xl border border-neutral-800 text-xs">
                <span className="text-neutral-400 block text-[0.625rem] uppercase font-semibold">
                  Cash Sales Collected
                </span>
                <span className="text-emerald-400 font-mono font-bold text-sm">
                  +GH₵{cashSales.toFixed(2)}
                </span>
              </div>

              <div className="bg-neutral-850 p-3 rounded-xl border border-neutral-800 text-xs">
                  <span className="text-neutral-400 block text-[0.625rem] uppercase font-semibold">
                    Mobile Money Sales
                  </span>
                <span className="text-sky-400 font-mono font-bold text-sm">
                  GH₵{cardSales.toFixed(2)}
                </span>
              </div>

              <div className="bg-neutral-850 p-3 rounded-xl border border-neutral-800 text-xs">
                <span className="text-neutral-400 block text-[0.625rem] uppercase font-semibold">
                  Total Cash Outflows
                </span>
                <span className="text-rose-400 font-mono font-bold text-sm">
                  -GH₵{payouts.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 text-center text-neutral-400 space-y-2">
            <Lock className="w-10 h-10 mx-auto text-amber-500/60" />
            <h3 className="text-base font-bold text-white">Register Drawer Is Closed</h3>
            <p className="text-xs text-neutral-500">
              Open a shift float to begin taking transactions and tracking cash reconciliation.
            </p>
          </div>
        )}

        {/* Shift History Table */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 bg-neutral-850 border-b border-neutral-800">
            <h4 className="font-bold text-white text-xs">Shift History & Reconciliation Ledger</h4>
          </div>
          <div className="md:hidden divide-y divide-neutral-800/70">
            {shiftHistory.length === 0 ? (
              <div className="p-8 text-center text-neutral-500 text-sm">No shifts recorded yet.</div>
            ) : (
              shiftHistory.map((s) => {
                const diff = Number(s.cashDifference || 0);
                const isClosed = s.status === "closed";
                return (
                  <div key={s.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-bold text-white">Shift #{s.id}</div>
                        <div className="text-[0.6875rem] text-neutral-400">
                          {s.userName} ·{" "}
                          {new Date(s.openedAt).toLocaleDateString()}{" "}
                          {new Date(s.openedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          {s.closedAt
                            ? ` → ${new Date(s.closedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                            : " → still open"}
                        </div>
                      </div>
                      <span
                        className={`shrink-0 px-2 py-1 rounded-md text-[0.6875rem] font-bold capitalize ${
                          isClosed ? "bg-neutral-800 text-neutral-400" : "bg-emerald-500/20 text-emerald-300"
                        }`}
                      >
                        {s.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-[0.6875rem]">
                      <div className="bg-neutral-850 rounded-lg px-2.5 py-2">
                        <div className="text-neutral-500">Float</div>
                        <div className="font-mono text-neutral-300">GH₵{Number(s.openingCash).toFixed(2)}</div>
                      </div>
                      <div className="bg-neutral-850 rounded-lg px-2.5 py-2">
                        <div className="text-neutral-500">Sales</div>
                        <div className="font-mono text-emerald-400 font-bold">GH₵{Number(s.totalSales).toFixed(2)}</div>
                      </div>
                      <div className="bg-neutral-850 rounded-lg px-2.5 py-2">
                        <div className="text-neutral-500">Counted</div>
                        <div className="font-mono text-neutral-300">
                          {s.actualClosingCash ? `GH₵${Number(s.actualClosingCash).toFixed(2)}` : "—"}
                        </div>
                      </div>
                    </div>

                    <div className="text-[0.6875rem]">
                      <span className="text-neutral-500">Over / short: </span>
                      <span
                        className={`font-mono font-bold ${
                          !isClosed
                            ? "text-neutral-500"
                            : Math.abs(diff) < 0.01
                            ? "text-neutral-500"
                            : diff > 0
                            ? "text-emerald-400"
                            : "text-rose-400"
                        }`}
                      >
                        {isClosed ? (diff > 0 ? `+GH₵${diff.toFixed(2)}` : `GH₵${diff.toFixed(2)}`) : "—"}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-850 text-neutral-400 uppercase text-[0.625rem] tracking-wider border-b border-neutral-800">
                <tr>
                  <th className="px-4 py-3">Shift ID</th>
                  <th className="px-4 py-3">Cashier</th>
                  <th className="px-4 py-3">Opened</th>
                  <th className="px-4 py-3">Closed</th>
                  <th className="px-4 py-3 text-right">Opening Float</th>
                  <th className="px-4 py-3 text-right">Total Sales</th>
                  <th className="px-4 py-3 text-right">Counted Cash</th>
                  <th className="px-4 py-3 text-right">Over / Short</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60 text-neutral-300 font-mono">
                {shiftHistory.map((s) => {
                  const diff = Number(s.cashDifference || 0);
                  const isClosed = s.status === "closed";

                  return (
                    <tr key={s.id} className="hover:bg-neutral-850/50">
                      <td className="px-4 py-3 font-bold text-white">#{s.id}</td>
                      <td className="px-4 py-3 font-sans text-neutral-200">{s.userName}</td>
                      <td className="px-4 py-3 text-neutral-400 text-[0.6875rem]">
                        {new Date(s.openedAt).toLocaleDateString()} {new Date(s.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-3 text-neutral-400 text-[0.6875rem]">
                        {s.closedAt ? new Date(s.closedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Active"}
                      </td>
                      <td className="px-4 py-3 text-right">GH₵{Number(s.openingCash).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-emerald-400 font-bold">
                        GH₵{Number(s.totalSales).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {s.actualClosingCash ? `GH₵${Number(s.actualClosingCash).toFixed(2)}` : "—"}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-bold ${
                          Math.abs(diff) < 0.01
                            ? "text-neutral-500"
                            : diff > 0
                            ? "text-emerald-400"
                            : "text-rose-400"
                        }`}
                      >
                        {isClosed ? (diff > 0 ? `+GH₵${diff.toFixed(2)}` : `GH₵${diff.toFixed(2)}`) : "—"}
                      </td>
                      <td className="px-4 py-3 font-sans capitalize">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[0.625rem] font-bold ${
                            isClosed
                              ? "bg-neutral-800 text-neutral-400"
                              : "bg-emerald-500/20 text-emerald-300"
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL 1: Open Shift */}
      {showOpenModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto">
          <form
            onSubmit={handleOpenShift}
            className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4 max-h-[92dvh] overflow-y-auto my-auto"
          >
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Unlock className="w-5 h-5 text-amber-400" />
              <span>Open Cash Register Shift</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-neutral-300 block mb-1">Starting Cash Float (GH₵)</label>
                <input
                  type="number"
                        inputMode="decimal"
                  step="10.00"
                  required
                  value={openingCashInput}
                  onChange={(e) => setOpeningCashInput(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white font-mono font-bold text-lg"
                />
              </div>

              <div>
                <label className="text-neutral-300 block mb-1">Shift Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Lunch shift register #1 opened by Akosua"
                  value={openNotes}
                  onChange={(e) => setOpenNotes(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setShowOpenModal(false)}
                className="px-3 py-1.5 text-xs text-neutral-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-semibold bg-amber-500 text-black rounded-lg"
              >
                Open Register
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 2: Record Cash Payout */}
      {showPayoutModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto">
          <form
            onSubmit={handleRecordPayout}
            className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4 max-h-[92dvh] overflow-y-auto my-auto"
          >
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <ArrowDownRight className="w-5 h-5 text-rose-400" />
              <span>Record Non-refund Cash Payout</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-neutral-300 block mb-1">Payout Amount (GH₵)</label>
                <input
                  type="number"
                        inputMode="decimal"
                  step="1.00"
                  required
                  placeholder="0.00"
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white font-mono font-bold text-lg"
                />
              </div>

              <div>
                <label className="text-neutral-300 block mb-1">Reason / Voucher Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Makola market tomatoes cash, ice block, safe drop"
                  value={payoutReason}
                  onChange={(e) => setPayoutReason(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setShowPayoutModal(false)}
                className="px-3 py-1.5 text-xs text-neutral-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-semibold bg-rose-600 text-white rounded-lg"
              >
                Record Payout
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 3: Close Shift & Reconciliation */}
      {showCloseModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto">
          <form
            onSubmit={handleCloseShift}
            className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4 max-h-[92dvh] overflow-y-auto my-auto"
          >
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Lock className="w-5 h-5 text-rose-400" />
              <span>End Shift & Cash Drawer Audit</span>
            </h3>

            <div className="p-3 bg-neutral-850 border border-neutral-800 rounded-xl space-y-1.5 text-xs">
              <div className="flex justify-between text-neutral-400">
                <span>Opening Cash Float:</span>
                <span className="font-mono">GH₵{openingFloat.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-neutral-400">
                <span>Total Cash Sales:</span>
                <span className="font-mono text-emerald-400">+GH₵{cashSales.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-neutral-400">
                <span>Total Cash Outflows (incl. refunds):</span>
                <span className="font-mono text-rose-400">-GH₵{payouts.toFixed(2)}</span>
              </div>
              <div className="pt-2 border-t border-neutral-750 flex justify-between font-bold text-white text-sm">
                <span>Expected Drawer Total:</span>
                <span className="font-mono text-amber-400">GH₵{expectedInDrawer.toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-neutral-300 block mb-1">
                  Physically Counted Cash in Drawer (GH₵)
                </label>
                <input
                  type="number"
                        inputMode="decimal"
                  step="1.00"
                  required
                  value={countedCashInput}
                  onChange={(e) => setCountedCashInput(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white font-mono font-bold text-xl"
                />
              </div>

              {/* Difference feedback */}
              <div
                className={`p-2.5 rounded-xl text-xs font-semibold flex items-center justify-between ${
                  Math.abs(variance) < 0.01
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                    : variance > 0
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    : "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                }`}
              >
                <span>Reconciliation Discrepancy:</span>
                <span className="font-mono text-sm">
                  {variance > 0 ? `+GH₵${variance.toFixed(2)} (Surplus)` : variance < 0 ? `-GH₵${Math.abs(variance).toFixed(2)} (Shortage)` : "GH₵0.00 (Balanced)"}
                </span>
              </div>

              <div>
                <label className="text-neutral-300 block mb-1">Manager Reconciliation Notes</label>
                <textarea
                  rows={2}
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  placeholder="Notes on discrepancy or register hand-over..."
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl p-2.5 text-xs text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setShowCloseModal(false)}
                className="px-3 py-1.5 text-xs text-neutral-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-xl shadow-xs"
              >
                Confirm Shift Close
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
