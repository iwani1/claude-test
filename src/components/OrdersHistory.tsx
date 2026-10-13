"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Receipt,
  Search,
  Filter,
  Eye,
  Printer,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  X,
  ShieldCheck,
  ChefHat,
  Trash2,
  Pencil,
} from "lucide-react";
import { ReceiptModal } from "./ReceiptModal";
import { KitchenTicketModal } from "./KitchenTicketModal";
import { ConfirmDialog } from "./ConfirmDialog";
import { EditOrderModal } from "./EditOrderModal";
import { ROLE_PERMISSIONS, UserRole } from "@/lib/permissions";
import { apiErrorMessage, apiFetch } from "@/lib/api-client";
import { notify } from "@/lib/notify";
import type { CurrentUser } from "@/lib/api-types";

export const OrdersHistory: React.FC<{ currentUser: CurrentUser }> = ({ currentUser }) => {
  const perms = ROLE_PERMISSIONS[currentUser?.role as UserRole] ?? ROLE_PERMISSIONS.cashier;
  /** Finance and stock roles read this screen; only till roles can act on it.
   *  A visible button that always answers 403 is worse than no button. */
  const canWorkTill = perms.canAccessPos;
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [total, setTotal] = useState(0);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Refund Modal
  const [refundOrderTarget, setRefundOrderTarget] = useState<any | null>(null);
  const [refundReason, setRefundReason] = useState("");
  const [refundManagerPin, setRefundManagerPin] = useState("");
  const [returnStock, setReturnStock] = useState(false);
  const [refundCash, setRefundCash] = useState("0.00");
  const [refundMomo, setRefundMomo] = useState("0.00");
  const [refundKey, setRefundKey] = useState("");
  const [refundBusy, setRefundBusy] = useState(false);
  const [refundLocked, setRefundLocked] = useState(false);
  const [refundLimits, setRefundLimits] = useState({ cashRemaining: "0.00", momoRemaining: "0.00" });
  const openRefund = async (order: any) => {
    try {
      const data = await apiFetch(`/api/orders/${order.id}/refund`);
      if (data.requiresReconciliation) { notify(data.error || "Historical tender records require reconciliation before refunding", "warn"); return; }
      setRefundLimits(data); setRefundCash(data.cashRemaining); setRefundMomo(data.momoRemaining);
      setRefundKey(crypto.randomUUID()); setRefundLocked(false); setRefundBusy(false);
      setRefundReason(""); setRefundManagerPin(""); setReturnStock(false); setRefundOrderTarget(order);
    } catch (e) { notify(apiErrorMessage(e, "Could not load refundable tender balances"), "error"); }
  };


  // Print Receipt Modal
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptOrder, setReceiptOrder] = useState<any | null>(null);

  // Kitchen docket reprint - the kitchen has no screen, so staff reprint the
  // paper ticket whenever a docket is lost or an item was missed.
  const [docketOrder, setDocketOrder] = useState<any | null>(null);
  const [showDocketModal, setShowDocketModal] = useState(false);

  // Owner-only hard delete. The confirm dialog stays open while the request
  // runs, and a server failure is shown inside it — never swallowed.
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState<"ok" | "danger">("ok");

  const PAGE_SIZE = 100;
  const fetchOrders = useCallback((offset = 0, append = false) => {
    setLoading(true);
    setLoadError("");
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    fetch(`/api/orders?${params.toString()}`)
      .then(res => { if (!res.ok) throw new Error(`Request failed (${res.status})`); return res.json(); })
      .then(data => {
        const rows = data.orders || [];
        setOrders(prev => (append ? [...prev, ...rows] : rows));
        setTotal(Number(data.total) || rows.length);
      })
      .catch(err => setLoadError(err?.message || "Could not load orders"))
      .finally(() => setLoading(false));
  }, [from, to]);

  const confirmDeleteOrder = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    setDeleteError("");
    try {
      const res = await fetch(`/api/orders/${deleteTarget.id}`, {
        method: "DELETE",
        // The API requires a JSON content type on every write (else 415).
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Delete failed (${res.status})`);
      const number = deleteTarget.orderNumber;
      setDeleteTarget(null);
      setNoticeTone("danger");
      setNotice(`Order ${number} was permanently deleted.`);
      fetchOrders(0, false);
    } catch (err: any) {
      setDeleteError(err?.message || "Delete failed");
    } finally {
      setDeleteBusy(false);
    }
  };

  // Load on the first tick (deferred so effects never setState synchronously),
  // then keep the list live: refresh on an interval and whenever the tab regains focus.
  useEffect(() => {
    const kick = setTimeout(() => fetchOrders(0, false), 0);
    const timer = setInterval(() => fetchOrders(0, false), 30_000);
    const onFocus = () => fetchOrders(0, false);
    window.addEventListener("focus", onFocus);
    return () => { clearTimeout(kick); clearInterval(timer); window.removeEventListener("focus", onFocus); };
  }, [fetchOrders]);

  const handleProcessRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundOrderTarget || refundBusy) return;
    setRefundBusy(true); setRefundLocked(true);

    try {
      const data = await apiFetch(`/api/orders/${refundOrderTarget.id}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: ((Math.round(Number(refundCash) * 100) + Math.round(Number(refundMomo) * 100)) / 100).toFixed(2),
          cashAmount: refundCash, momoAmount: refundMomo, idempotencyKey: refundKey,
          reason: refundReason,
          managerPin: refundManagerPin,
          returnStock,
        }),
      });
      if (data.success) {
        notify(`Order ${refundOrderTarget.orderNumber} successfully refunded!`, "ok");
        setRefundOrderTarget(null);
        setRefundReason("");
        fetchOrders();
      } else {
        setRefundLocked(false);
        notify(data.error || "Refund failed", "error");
      }
    } catch (e) {
      notify(apiErrorMessage(e, "Refund result is unknown. Retry this unchanged request to check its result; do not issue a second refund."), "warn");
    } finally { setRefundBusy(false); }
  };

  const filteredOrders = orders.filter((o) => {
    const matchStatus = statusFilter === "all" || o.status === statusFilter;
    const matchSearch =
      !searchQuery ||
      o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.customerName?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchStatus && matchSearch;
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-neutral-950 overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-neutral-900 border-b border-neutral-800 flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Receipt className="w-5 h-5 text-amber-500" />
            <span>Orders & Transaction History</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            {canWorkTill
              ? "Audit transactions, reprint receipts, and process manager refunds"
              : "Audit transactions and reprint receipts"}
          </p>
          {!canWorkTill && (
            <p className="text-[0.6875rem] text-amber-300/90 mt-1">
              Read-only: refunds, edits and deletions are done at the till by the owner or a manager.
            </p>
          )}
        </div>

        {/* Search & Filter */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search order # or guest..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-neutral-800 border border-neutral-700 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="preparing">Preparing</option>
            <option value="ready">Ready</option>
            <option value="refunded">Refunded</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            title="From date"
            className="bg-neutral-800 border border-neutral-700 rounded-xl px-2 py-1.5 text-xs text-white focus:outline-none"
          />
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            title="To date"
            className="bg-neutral-800 border border-neutral-700 rounded-xl px-2 py-1.5 text-xs text-white focus:outline-none"
          />
          {(from || to) && (
            <button
              onClick={() => { setFrom(""); setTo(""); }}
              className="px-2 py-1.5 text-xs text-amber-400 hover:text-amber-300"
            >
              Clear dates
            </button>
          )}
        </div>
      </div>

      {/* Orders Table */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-xl">
          {/* Phones: one card per order, every action a full-width-height tap
              target instead of a 26px icon. md and up keep the table below. */}
          <div className="md:hidden divide-y divide-neutral-800/70">
            {loading && orders.length === 0 ? (
              <div className="p-8 text-center text-neutral-500 text-sm">Loading orders…</div>
            ) : loadError ? (
              <div className="p-6 text-center">
                <div className="text-rose-300 font-medium mb-3 text-sm">Could not load orders: {loadError}</div>
                <button
                  onClick={() => fetchOrders(0, false)}
                  className="h-12 px-4 rounded-xl bg-amber-500 text-neutral-900 font-bold"
                >
                  Retry
                </button>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="p-8 text-center text-neutral-500 text-sm">
                {orders.length === 0
                  ? "No orders found for this date range."
                  : "No orders match your search or filter."}
              </div>
            ) : (
              filteredOrders.map((ord) => {
                const isCompleted = ord.status === "completed";
                const isRefunded = ord.status === "refunded";
                const isCancelled = ord.status === "cancelled";
                return (
                  <div key={ord.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-mono font-bold text-white text-sm break-all">{ord.orderNumber}</div>
                        <div className="text-[0.6875rem] text-neutral-400">
                          {new Date(ord.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-mono font-bold text-white text-base">
                          GH₵{Number(ord.totalAmount).toFixed(2)}
                        </div>
                        <div className="text-[0.6875rem] text-neutral-400">
                          {ord.items?.length || 0} item{(ord.items?.length || 0) === 1 ? "" : "s"}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 text-[0.6875rem] font-bold">
                      <span className="px-2 py-1 rounded-md bg-neutral-800 text-neutral-300 capitalize">
                        {ord.orderType?.replace("_", " ")}
                        {ord.tableId ? ` · T-#${ord.tableId}` : ""}
                      </span>
                      <span className="px-2 py-1 rounded-md bg-neutral-800 text-neutral-300 font-medium max-w-[11rem] truncate">
                        {ord.customerName}
                      </span>
                      <span
                        className={`px-2 py-1 rounded-md capitalize ${
                          ord.paymentStatus === "paid"
                            ? "bg-emerald-500/10 text-emerald-300"
                            : ord.paymentStatus === "refunded"
                            ? "bg-rose-500/10 text-rose-300"
                            : "bg-amber-500/10 text-amber-300"
                        }`}
                      >
                        {ord.paymentStatus}
                      </span>
                      <span
                        className={`px-2 py-1 rounded-md capitalize ${
                          isCompleted
                            ? "bg-emerald-500/20 text-emerald-300"
                            : isRefunded
                            ? "bg-rose-500/20 text-rose-300"
                            : isCancelled
                            ? "bg-neutral-800 text-neutral-400"
                            : "bg-amber-500/20 text-amber-300"
                        }`}
                      >
                        {ord.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => {
                          setDocketOrder(ord);
                          setShowDocketModal(true);
                        }}
                        className="h-12 px-3.5 rounded-xl bg-orange-600/20 border border-orange-600/40 text-orange-300 font-semibold text-xs flex items-center gap-1.5 transition active:scale-[0.97]"
                      >
                        <ChefHat className="w-4 h-4" /> Docket
                      </button>
                      <button
                        onClick={() => {
                          setReceiptOrder(ord);
                          setShowReceiptModal(true);
                        }}
                        className="h-12 px-3.5 rounded-xl bg-neutral-800 border border-neutral-700 text-neutral-200 font-semibold text-xs flex items-center gap-1.5 transition active:scale-[0.97]"
                      >
                        <Printer className="w-4 h-4" /> Receipt
                      </button>
                      {canWorkTill && Number(ord.paidAmount) > 0 && ord.paymentStatus !== "refunded" && (
                        <button
                          onClick={() => openRefund(ord)}
                          className="h-12 px-3.5 rounded-xl bg-neutral-800 border border-neutral-700 text-neutral-200 font-semibold text-xs flex items-center gap-1.5 transition active:scale-[0.97]"
                        >
                          <RotateCcw className="w-4 h-4 text-rose-400" /> Refund
                        </button>
                      )}
                      {currentUser?.role === "super_admin" && (
                        <button
                          onClick={() => setEditTarget(ord)}
                          className="h-12 px-3.5 rounded-xl bg-neutral-800 border border-neutral-700 text-neutral-200 font-semibold text-xs flex items-center gap-1.5 transition active:scale-[0.97]"
                          aria-label={`Edit order ${ord.orderNumber}`}
                        >
                          <Pencil className="w-4 h-4" /> Edit
                        </button>
                      )}
                      {currentUser?.role === "super_admin" && (
                        <button
                          onClick={() => {
                            setDeleteError("");
                            setDeleteTarget(ord);
                          }}
                          className="h-12 px-3.5 rounded-xl bg-rose-600/20 border border-rose-500/50 text-rose-300 font-semibold text-xs flex items-center gap-1.5 transition active:scale-[0.97]"
                          aria-label={`Delete order ${ord.orderNumber}`}
                        >
                          <Trash2 className="w-4 h-4" /> Delete
                        </button>
                      )}
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
                  <th className="px-4 py-3">Order #</th>
                  <th className="px-4 py-3">Date & Time</th>
                  <th className="px-4 py-3">Type / Table</th>
                  <th className="px-4 py-3">Guest</th>
                  <th className="px-4 py-3 text-right">Items</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Payment</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60 text-neutral-300">
                {loading && orders.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-neutral-500">
                      Loading orders…
                    </td>
                  </tr>
                ) : loadError ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center">
                      <div className="text-rose-300 font-medium mb-2">Could not load orders: {loadError}</div>
                      <button
                        onClick={() => fetchOrders(0, false)}
                        className="px-3 py-1.5 rounded-xl bg-amber-500 text-neutral-900 text-xs font-bold hover:bg-amber-400"
                      >
                        Retry
                      </button>
                    </td>
                  </tr>
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-neutral-500">
                      {orders.length === 0
                        ? "No orders found for this date range."
                        : "No orders match your search or filter."}
                    </td>
                  </tr>
                ) : filteredOrders.map((ord) => {
                  const isCompleted = ord.status === "completed";
                  const isRefunded = ord.status === "refunded";
                  const isCancelled = ord.status === "cancelled";

                  return (
                    <tr key={ord.id} className="hover:bg-neutral-850/50">
                      <td className="px-4 py-3 font-mono font-bold text-white">
                        {ord.orderNumber}
                      </td>
                      <td className="px-4 py-3 text-neutral-400 text-[0.6875rem]">
                        {new Date(ord.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 capitalize text-neutral-300">
                        {ord.orderType?.replace("_", " ")}
                        {ord.tableId ? ` (T-#${ord.tableId})` : ""}
                      </td>
                      <td className="px-4 py-3 font-medium text-white">{ord.customerName}</td>
                      <td className="px-4 py-3 text-right font-mono text-neutral-400">
                        {ord.items?.length || 0}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-white">
                        GH₵{Number(ord.totalAmount).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono capitalize">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[0.625rem] font-bold ${
                            ord.paymentStatus === "paid"
                              ? "bg-emerald-500/10 text-emerald-300"
                              : ord.paymentStatus === "refunded"
                              ? "bg-rose-500/10 text-rose-300"
                              : "bg-amber-500/10 text-amber-300"
                          }`}
                        >
                          {ord.paymentStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 capitalize">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[0.625rem] font-bold ${
                            isCompleted
                              ? "bg-emerald-500/20 text-emerald-300"
                              : isRefunded
                              ? "bg-rose-500/20 text-rose-300"
                              : isCancelled
                              ? "bg-neutral-800 text-neutral-400"
                              : "bg-amber-500/20 text-amber-300"
                          }`}
                        >
                          {ord.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setDocketOrder(ord);
                              setShowDocketModal(true);
                            }}
                            className="p-1.5 bg-orange-600/20 hover:bg-orange-600 text-orange-300 hover:text-white rounded-lg transition border border-orange-600/40"
                            title="Reprint Kitchen Docket (paper ticket for the kitchen)"
                          >
                            <ChefHat className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => {
                              setReceiptOrder(ord);
                              setShowReceiptModal(true);
                            }}
                            className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-lg transition"
                            title="Print / View Customer Receipt"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          {canWorkTill && Number(ord.paidAmount) > 0 && ord.paymentStatus !== "refunded" && (
                            <button
                              onClick={() => openRefund(ord)}
                              className="px-2 py-1 bg-neutral-800 hover:bg-rose-950/40 text-neutral-300 hover:text-rose-400 rounded-lg text-[0.6875rem] font-medium border border-neutral-700 transition flex items-center gap-1"
                              title="Process Refund"
                            >
                              <RotateCcw className="w-3 h-3 text-rose-400" />
                              <span>Refund</span>
                            </button>
                          )}

                          {currentUser?.role === "super_admin" && (
                            <button
                              onClick={() => setEditTarget(ord)}
                              className="p-1.5 bg-neutral-800 hover:bg-amber-500 text-neutral-400 hover:text-black rounded-lg transition border border-neutral-700 hover:border-amber-400"
                              title="Edit this order (owner only)"
                              aria-label={`Edit order ${ord.orderNumber}`}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {currentUser?.role === "super_admin" && (
                            <button
                              onClick={() => {
                                setDeleteError("");
                                setDeleteTarget(ord);
                              }}
                              className="p-1.5 bg-neutral-800 hover:bg-rose-600 text-neutral-400 hover:text-white rounded-lg transition border border-neutral-700 hover:border-rose-500"
                              title="Delete this order permanently (owner only)"
                              aria-label={`Delete order ${ord.orderNumber}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {notice && (
          <div
            className={`mt-3 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between gap-3 border ${
              noticeTone === "ok"
                ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                : "bg-rose-500/10 border-rose-500/40 text-rose-300"
            }`}
          >
            <span>{notice}</span>
            <button onClick={() => setNotice("")} className="hover:text-white" aria-label="Dismiss">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Live count + pagination — the list must never fail silently */}
        <div className="mt-3 flex flex-col items-center gap-2">
          <div className="text-[0.6875rem] text-neutral-400">
            {loading
              ? "Loading orders…"
              : loadError
              ? ""
              : `Showing ${orders.length} of ${total} orders (newest first)`}
          </div>
          {!loading && !loadError && orders.length < total && (
            <button
              onClick={() => fetchOrders(orders.length, true)}
              className="px-4 py-2 rounded-xl bg-neutral-800 border border-neutral-700 text-xs text-white hover:border-amber-500"
            >
              Load older orders ({total - orders.length} more)
            </button>
          )}
        </div>
      </div>

      {/* MODAL 1: Refund Processing with Manager Authorization */}
      {refundOrderTarget && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto">
          <form
            onSubmit={handleProcessRefund}
            className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4 max-h-[92dvh] overflow-y-auto my-auto"
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-rose-400" />
                  <span>Manager Refund Authorization</span>
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Order {refundOrderTarget.orderNumber} - Amount: GH₵{Number(refundOrderTarget.totalAmount).toFixed(2)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRefundOrderTarget(null)}
                className="text-neutral-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-amber-300">Record money actually returned. Cash is automatically deducted from the current drawer; do not create another payout. MoMo transfers must be completed and verified separately.</p>
              <div className="grid grid-cols-2 gap-3">
                <label>Cash returned (max GH₵{refundLimits.cashRemaining})
                  <input aria-label="Cash refund" type="number"
                        inputMode="decimal" min="0" step="0.01" max={refundLimits.cashRemaining} required disabled={refundLocked} value={refundCash} onChange={e => setRefundCash(e.target.value)} className="w-full bg-neutral-800 p-2 rounded mt-1" />
                </label>
                <label>MoMo returned (max GH₵{refundLimits.momoRemaining})
                  <input aria-label="MoMo refund" type="number"
                        inputMode="decimal" min="0" step="0.01" max={refundLimits.momoRemaining} required disabled={refundLocked} value={refundMomo} onChange={e => setRefundMomo(e.target.value)} className="w-full bg-neutral-800 p-2 rounded mt-1" />
                </label>
              </div>
              {refundLocked && !refundBusy && <p role="alert" className="text-amber-300">Retry the unchanged request to resolve its status before starting another refund.</p>}
              <div>
                <label className="text-neutral-300 block mb-1">Reason for Refund</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dissatisfied with dish, order error"
                  disabled={refundLocked}
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="text-neutral-300 block mb-1">Manager PIN Authorization</label>
                <input
                  type="password"
                  maxLength={8}
                  required
                  value={refundManagerPin}
                  onChange={(e) => setRefundManagerPin(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white font-mono text-center tracking-widest text-lg"
                />
                <span className="text-[0.625rem] text-neutral-500 mt-0.5 block">
                  Enter your assigned 4–8 digit Manager or Owner authorization PIN
                </span>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="returnStockCheck"
                  disabled={refundLocked}
                  checked={returnStock}
                  onChange={(e) => setReturnStock(e.target.checked)}
                  className="rounded border-neutral-700 text-amber-500 focus:ring-0"
                />
                <label htmlFor="returnStockCheck" className="text-neutral-300 text-xs">
                  Return Recipe Ingredients to Active Stock
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setRefundOrderTarget(null)}
                className="px-3 py-1.5 text-xs text-neutral-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={refundBusy}
                className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-xl shadow-xs"
              >
                {refundBusy ? "Recording…" : refundLocked ? "Retry Same Refund" : "Authorize & Record Refund"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 2: Reprint Receipt */}
      {showReceiptModal && receiptOrder && (
        <ReceiptModal
          isOpen={showReceiptModal}
          onClose={() => setShowReceiptModal(false)}
          order={receiptOrder}
        />
      )}
      {/* OWNER-ONLY ORDER EDITOR */}
      {editTarget && (
        <EditOrderModal
          order={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={(result) => {
            const number = editTarget?.orderNumber;
            setEditTarget(null);
            const due = Number(result?.balanceDue || 0);
            const collected = Number(result?.collected || 0);
            setNoticeTone("ok");
            setNotice(
              due > 0
                ? collected > 0
                  ? `Order ${number} updated. Collect GH₵${due.toFixed(2)} more from the guest.`
                  : `Order ${number} updated. GH₵${due.toFixed(2)} is still to be paid.`
                : `Order ${number} updated.`
            );
            fetchOrders(0, false);
          }}
        />
      )}

      {/* OWNER-ONLY PERMANENT DELETE */}
      <ConfirmDialog
        open={!!deleteTarget}
        title={deleteTarget ? `Delete order ${deleteTarget.orderNumber}?` : "Delete order?"}
        message={
          deleteTarget
            ? `Permanent: GH₵${Number(deleteTarget.totalAmount || 0).toFixed(2)} disappears from history, reports and collections, and any stock it used goes back to inventory. A minimal deletion record (order number, amount, who deleted it) is kept for accounting. This cannot be undone.`
            : ""
        }
        confirmLabel="Delete forever"
        cancelLabel="Keep it"
        busy={deleteBusy}
        busyLabel="Deleting…"
        error={deleteError}
        onCancel={() => {
          setDeleteTarget(null);
          setDeleteError("");
        }}
        onConfirm={confirmDeleteOrder}
      />

      {/* KITCHEN DOCKET REPRINT */}
      {showDocketModal && docketOrder && (
        <KitchenTicketModal
          isOpen={showDocketModal}
          onClose={() => {
            setShowDocketModal(false);
            setDocketOrder(null);
          }}
          order={docketOrder}
        />
      )}
    </div>
  );
};
