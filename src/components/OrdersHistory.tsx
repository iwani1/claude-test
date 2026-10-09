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
} from "lucide-react";
import { ReceiptModal } from "./ReceiptModal";
import { KitchenTicketModal } from "./KitchenTicketModal";

export const OrdersHistory: React.FC<{ currentUser: any }> = ({ currentUser }) => {
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Refund Modal
  const [refundOrderTarget, setRefundOrderTarget] = useState<any | null>(null);
  const [refundReason, setRefundReason] = useState("");
  const [refundManagerPin, setRefundManagerPin] = useState("");
  const [returnStock, setReturnStock] = useState(true);

  // Print Receipt Modal
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptOrder, setReceiptOrder] = useState<any | null>(null);

  // Kitchen docket reprint - the kitchen has no screen, so staff reprint the
  // paper ticket whenever a docket is lost or an item was missed.
  const [docketOrder, setDocketOrder] = useState<any | null>(null);
  const [showDocketModal, setShowDocketModal] = useState(false);

  const fetchOrders = useCallback(() => fetch("/api/orders?limit=100")
    .then(res => { if (!res.ok) throw new Error("Request failed"); return res.json(); })
    .then(data => {
      if (data.orders) {
        setOrders(data.orders);
      }

    }).catch(console.error), []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleProcessRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundOrderTarget) return;

    try {
      const res = await fetch(`/api/orders/${refundOrderTarget.id}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: refundOrderTarget.paidAmount || refundOrderTarget.totalAmount,
          reason: refundReason,
          managerPin: refundManagerPin,
          returnStock,
        }),
      });

      const data = await res.json();
      if (data.success) {
        alert(`Order ${refundOrderTarget.orderNumber} successfully refunded!`);
        setRefundOrderTarget(null);
        setRefundReason("");
        fetchOrders();
      } else {
        alert(data.error || "Refund failed");
      }
    } catch {
      alert("Error processing refund");
    }
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
            Audit transactions, reprint receipts, and process manager refunds
          </p>
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
        </div>
      </div>

      {/* Orders Table */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-850 text-neutral-400 uppercase text-[10px] tracking-wider border-b border-neutral-800">
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
                {filteredOrders.map((ord) => {
                  const isCompleted = ord.status === "completed";
                  const isRefunded = ord.status === "refunded";
                  const isCancelled = ord.status === "cancelled";

                  return (
                    <tr key={ord.id} className="hover:bg-neutral-850/50">
                      <td className="px-4 py-3 font-mono font-bold text-white">
                        {ord.orderNumber}
                      </td>
                      <td className="px-4 py-3 text-neutral-400 text-[11px]">
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
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
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
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
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

                          {isCompleted && (
                            <button
                              onClick={() => {
                                setRefundOrderTarget(ord);
                                setRefundReason("");
                              }}
                              className="px-2 py-1 bg-neutral-800 hover:bg-rose-950/40 text-neutral-300 hover:text-rose-400 rounded-lg text-[11px] font-medium border border-neutral-700 transition flex items-center gap-1"
                              title="Process Refund"
                            >
                              <RotateCcw className="w-3 h-3 text-rose-400" />
                              <span>Refund</span>
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
      </div>

      {/* MODAL 1: Refund Processing with Manager Authorization */}
      {refundOrderTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <form
            onSubmit={handleProcessRefund}
            className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4"
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
              <div>
                <label className="text-neutral-300 block mb-1">Reason for Refund</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dissatisfied with dish, order error"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="text-neutral-300 block mb-1">Manager PIN Authorization</label>
                <input
                  type="password"
                  maxLength={4}
                  required
                  value={refundManagerPin}
                  onChange={(e) => setRefundManagerPin(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white font-mono text-center tracking-widest text-lg"
                />
                <span className="text-[10px] text-neutral-500 mt-0.5 block">
                  Enter your assigned 4-digit Manager or Owner authorization PIN
                </span>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="returnStockCheck"
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
                className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-xl shadow-xs"
              >
                Authorize & Refund
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
