"use client";

import { LoadFailure } from "./LoadFailure";

import React, { useState, useEffect, useCallback } from "react";
import {
  BarChart3,
  Calendar,
  TrendingUp,
  DollarSign,
  Percent,
  Download,
  Printer,
  ShoppingBag,
  CreditCard,
  PieChart,
  ArrowUpRight,
  FileSpreadsheet,
  Smartphone,
} from "lucide-react";
import { apiErrorMessage, apiFetch } from "@/lib/api-client";
import { notify } from "@/lib/notify";

type PresetTimeframe = "today" | "7days" | "30days" | "all";
type Timeframe = PresetTimeframe | "custom";

export const ReportsDashboard: React.FC<{ canExportTransactions?: boolean }> = ({ canExportTransactions = false }) => {
  const [timeframe, setTimeframe] = useState<Timeframe>("all");
  // Custom range: the inputs are a draft until "Apply" is tapped, so the
  // report (and the CSV exports) never chase half-typed dates.
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [appliedRange, setAppliedRange] = useState<{ start: string; end: string } | null>(null);
  const [data, setData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchReports = useCallback(() => {
    if (timeframe === "custom" && !appliedRange) {
      // Nothing to ask the server yet: keep the last figures on screen.
      return Promise.resolve();
    }
    const query = timeframe === "custom"
      ? `timeframe=custom&start=${appliedRange!.start}&end=${appliedRange!.end}`
      : `timeframe=${timeframe}`;
    return fetch(`/api/reports?${query}`)
      .then(res => { if (!res.ok) throw new Error("Request failed"); return res.json(); })
      .then(json => {
        setLoadError(null);
        setData(json);

      }).catch(() => setLoadError("Reports could not be loaded. The figures shown may be out of date.")).finally(() => setIsLoading(false));
  }, [timeframe, appliedRange]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const applyCustomRange = () => {
    if (!startDate || !endDate) {
      notify("Choose both a start date and an end date", "warn");
      return;
    }
    if (startDate > endDate) {
      notify("The start date must be on or before the end date", "warn");
      return;
    }
    setIsLoading(true);
    setAppliedRange({ start: startDate, end: endDate });
  };

  const handleExportCSV = async (format: "quickbooks" | "xero") => {
    if (timeframe === "custom" && !appliedRange) {
      notify("Choose a start and end date, then tap Apply — the export follows the dates on screen", "warn");
      return;
    }
    try {
      const exportData = await apiFetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "export_accounting",
          format,
          timeframe,
          ...(timeframe === "custom" && appliedRange ? appliedRange : {}),
        }),
      });
      if (exportData.csvContent) {
        const blob = new Blob([exportData.csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `lushview_hotel_sales_${format}_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        notify(data.error || "Export produced no data", "error");
      }
    } catch (e) {
      notify(apiErrorMessage(e, "Failed to export accounting CSV"), "error");
    }
  };

  const summary = data?.summary || {
    totalSales: "0.00",
    totalOrdersCount: 0,
    avgOrderValue: "0.00",
    totalCostOfGoods: "0.00",
    grossProfit: "0.00",
    foodCostPercentage: "0.0",
    totalWastageCost: "0.00",
    totalRoomCharge: "0.00",
    totalCompValue: "0.00",
    compOrderCount: 0,
    paidOrderCount: 0,
  };

  const compOrders = data?.complimentaryOrders || [];

  const categories = data?.categoryBreakdown || [];
  const topItems = data?.topItems || [];
  const payments = data?.paymentBreakdown || { momo: 0, cash: 0, card: 0, stripe: 0 };

  return (
    <div className="flex-1 flex flex-col h-full bg-neutral-950 overflow-hidden">
      <LoadFailure message={loadError} onRetry={fetchReports} />
      {/* Header */}
      <div className="p-4 bg-neutral-900 border-b border-neutral-800 flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-amber-500" />
            <span>Financial Analytics & Sales Reporting (GH₵)</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Real database transaction metrics, food cost ratio, and accounting exports in Ghanaian Cedis
          </p>
        </div>

        {/* Date Filter & Export */}
        <div className="flex flex-col items-start sm:items-end gap-2 text-xs">
          <div className="flex items-center gap-2">
          <div className="bg-neutral-950 p-1 rounded-xl border border-neutral-800 flex">
            {(["today", "7days", "30days", "all", "custom"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTimeframe(t)}
                className={`px-3 py-1.5 rounded-lg font-semibold capitalize transition ${
                  timeframe === t
                    ? "bg-amber-500 text-black shadow-xs"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                {t === "7days" ? "7 Days" : t === "30days" ? "30 Days" : t}
              </button>
            ))}
          </div>

          {canExportTransactions && <>
          <button
            onClick={() => handleExportCSV("quickbooks")}
            className="px-3 py-2 bg-neutral-800 hover:bg-neutral-750 text-neutral-200 font-semibold rounded-xl border border-neutral-700 flex items-center gap-1.5 transition"
            title="Download QuickBooks CSV"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span className="hidden md:inline">QuickBooks CSV</span>
          </button>

          <button
            onClick={() => handleExportCSV("xero")}
            className="px-3 py-2 bg-neutral-800 hover:bg-neutral-750 text-neutral-200 font-semibold rounded-xl border border-neutral-700 flex items-center gap-1.5 transition"
            title="Download Xero CSV"
          >
            <Download className="w-4 h-4 text-sky-400" />
            <span className="hidden md:inline">Xero CSV</span>
          </button>
          </>}
          </div>

          {timeframe === "custom" && (
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-neutral-400 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-500" />
                From
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  title="Start date"
                  className="bg-neutral-800 border border-neutral-700 rounded-xl px-2 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </label>
              <label className="text-neutral-400 flex items-center gap-1.5">
                To
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  title="End date"
                  className="bg-neutral-800 border border-neutral-700 rounded-xl px-2 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </label>
              <button
                onClick={applyCustomRange}
                className="min-h-9 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl transition"
              >
                Apply
              </button>
              <span className="text-neutral-500">Whole days, Ghana time (UTC) — same start and end picks a single day.</span>
            </div>
          )}
        </div>
      </div>

      {/* Reports Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {timeframe === "custom" && appliedRange && (
          <p className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            Showing {appliedRange.start} to {appliedRange.end} (Ghana time)
          </p>
        )}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3" aria-label="Collection reconciliation">
          {[["Gross collections", summary.grossCollections], ["Refunds recorded", summary.totalRefunds], ["Net collections", summary.netCollections]].map(([label, value]) => (
            <div key={label} className="foil-card p-4 rounded-2xl bg-neutral-900 border border-neutral-800">
              <h3 className="text-xs text-neutral-400">{label}</h3><p className="text-xl font-mono text-white">GH₵{Number(value || 0).toFixed(2)}</p>
            </div>
          ))}
        </section>
        <p className="text-xs text-neutral-400">Collections use payment dates; refunds use refund dates (UTC / Africa/Accra). Net collections can be negative when older sales are refunded. These are manual tender records, not verified bank balances or a tax return.</p>
        <p className="text-xs text-neutral-400">Cash: GH₵{summary.cashCollections || "0.00"} collected / GH₵{summary.cashRefunds || "0.00"} refunded · MoMo: GH₵{summary.momoCollections || "0.00"} collected / GH₵{summary.momoRefunds || "0.00"} refunded</p>
        {Number(summary.unallocatedRefunds) > 0 && <p role="alert" className="text-amber-300 text-sm">GH₵{summary.unallocatedRefunds} of historical refunds have unknown tender. They reduce net collections but need manual cash/MoMo reconciliation.</p>}
        <p className="text-xs text-neutral-500">CSV exports contain payment/refund events for this timeframe; review and map them before importing into accounting software. Item/category charts remain gross bill analysis.</p>
        {/* KPI Cards Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          <div className="foil-card bg-neutral-900 border border-neutral-800 rounded-2xl p-4 shadow-lg">
            <span className="text-[0.625rem] text-neutral-400 uppercase font-bold tracking-wider block">
              Gross Billed Sales
            </span>
            <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
              GH₵{Number(summary.totalSales).toLocaleString()}
            </div>
            <div className="text-[0.6875rem] text-neutral-500 mt-1 flex items-center gap-1">
              <span>{summary.totalOrdersCount} bills created (before refunds)</span>
            </div>
          </div>

          <div className="foil-card bg-neutral-900 border border-neutral-800 rounded-2xl p-4 shadow-lg">
            <span className="text-[0.625rem] text-neutral-400 uppercase font-bold tracking-wider block">
              Gross Bill Margin (Estimate)
            </span>
            <div className="text-2xl font-bold font-mono text-white mt-1">
              GH₵{Number(summary.grossProfit).toLocaleString()}
            </div>
            <div className="text-[0.6875rem] text-neutral-500 mt-1">
              COGS: GH₵{Number(summary.totalCostOfGoods).toFixed(2)}
            </div>
          </div>

          <div className="foil-card bg-neutral-900 border border-neutral-800 rounded-2xl p-4 shadow-lg">
            <span className="text-[0.625rem] text-neutral-400 uppercase font-bold tracking-wider block">
              Food Cost Ratio
            </span>
            <div className="text-2xl font-bold font-mono text-amber-400 mt-1">
              {summary.foodCostPercentage}%
            </div>
            <div className="text-[0.6875rem] text-neutral-500 mt-1">Industry target: 28-35%</div>
          </div>

          <div className="foil-card bg-neutral-900 border border-neutral-800 rounded-2xl p-4 shadow-lg">
            <span className="text-[0.625rem] text-neutral-400 uppercase font-bold tracking-wider block">
              Average Check (AOV)
            </span>
            <div className="text-2xl font-bold font-mono text-sky-400 mt-1">
              GH₵{Number(summary.avgOrderValue).toFixed(2)}
            </div>
            <div className="text-[0.6875rem] text-neutral-500 mt-1">
              Across {summary.paidOrderCount ?? 0} paid bills
            </div>
          </div>

          {/* Eat-in room charge collected — separate from dish revenue */}
          <div className="bg-neutral-900 border border-sky-500/30 rounded-2xl p-4 shadow-lg">
            <span className="text-[0.625rem] text-sky-300/80 uppercase font-bold tracking-wider block">
              Room Charge Collected
            </span>
            <div className="text-2xl font-bold font-mono text-sky-300 mt-1">
              GH₵{Number(summary.totalRoomCharge || 0).toFixed(2)}
            </div>
            <div className="text-[0.6875rem] text-neutral-500 mt-1">Eat-in fee on dine-in bills</div>
          </div>

          {/* Complimentary breakfast exposure */}
          <div className="bg-neutral-900 border border-amber-500/30 rounded-2xl p-4 shadow-lg">
            <span className="text-[0.625rem] text-amber-300/80 uppercase font-bold tracking-wider block">
              Complimentary Value
            </span>
            <div className="text-2xl font-bold font-mono text-amber-300 mt-1">
              GH₵{Number(summary.totalCompValue || 0).toFixed(2)}
            </div>
            <div className="text-[0.6875rem] text-neutral-500 mt-1">
              {summary.compOrderCount ?? 0} free order{(summary.compOrderCount ?? 0) === 1 ? "" : "s"}
            </div>
          </div>
        </div>

        {/* Section 2: Breakdown Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Category Sales Breakdown */}
          <div className="lg:col-span-2 bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <PieChart className="w-4 h-4 text-amber-500" />
              <span>Revenue by Menu Category</span>
            </h3>

            <div className="space-y-3">
              {categories.map((cat: any, idx: number) => {
                const totalRev = Number(summary.totalSales) || 1;
                const pct = Math.min(100, (cat.revenue / totalRev) * 100);

                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs text-neutral-200">
                      <span className="font-semibold">{cat.name}</span>
                      <span className="font-mono text-neutral-400">
                        GH₵{cat.revenue.toFixed(2)} ({cat.count} sold)
                      </span>
                    </div>
                    {/* Bar visual */}
                    <div className="w-full h-2 rounded-full bg-neutral-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}

              {categories.length === 0 && (
                <div className="py-6 text-center text-xs text-neutral-500">
                  No sales recorded in this timeframe.
                </div>
              )}
            </div>
          </div>

          {/* Payment Method Breakdown (MoMo, Cash, Card) */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-amber-400" />
              <span>Ghana Payment Tender Breakdown</span>
            </h3>

            <div className="space-y-3">
              <div className="p-3 bg-neutral-850 rounded-xl border border-neutral-800 flex justify-between items-center text-xs">
                <div>
                  <span className="font-semibold text-white block">Mobile Money (MoMo)</span>
                  <span className="text-[0.625rem] text-neutral-400">Recorded by staff</span>
                </div>
                <span className="font-mono font-bold text-amber-400 text-sm">
                  GH₵{Number(payments.momo || payments.stripe || 0).toFixed(2)}
                </span>
              </div>

              <div className="p-3 bg-neutral-850 rounded-xl border border-neutral-800 flex justify-between items-center text-xs">
                <div>
                  <span className="font-semibold text-white block">Cash (GH₵)</span>
                  <span className="text-[0.625rem] text-neutral-400">Physical register drawer</span>
                </div>
                <span className="font-mono font-bold text-emerald-400 text-sm">
                  GH₵{Number(payments.cash || 0).toFixed(2)}
                </span>
              </div>

              <div className="p-3 bg-neutral-850 rounded-xl border border-neutral-800 flex justify-between items-center text-xs">
                <div>
                  <span className="font-semibold text-white block">Total Collections</span>
                  <span className="text-[0.625rem] text-neutral-400">MoMo + Cash combined</span>
                </div>
                <span className="font-mono font-bold text-white text-sm">
                  GH₵
                  {(
                    Number(payments.momo || payments.stripe || 0) + Number(payments.cash || 0)
                  ).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Top Selling Menu Items */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 bg-neutral-850 border-b border-neutral-800 flex justify-between items-center">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Top Selling Dishes & Beverages
            </h3>
            <span className="text-[0.6875rem] text-neutral-400 font-mono">Volume Rank</span>
          </div>

          <div className="md:hidden divide-y divide-neutral-800/70">
            {topItems.length === 0 ? (
              <div className="p-8 text-center text-neutral-500 text-sm">
                No sales in this period yet.
              </div>
            ) : (
              topItems.map((item: any, idx: number) => (
                <div key={idx} className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex items-center gap-3">
                    <span className="shrink-0 w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold font-mono flex items-center justify-center text-xs">
                      #{idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold text-white truncate">{item.name}</div>
                      <div className="text-[0.6875rem] text-neutral-400">{item.quantity} sold</div>
                    </div>
                  </div>
                  <div className="shrink-0 font-mono font-bold text-emerald-400">
                    GH₵{item.revenue.toFixed(2)}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-850 text-neutral-400 uppercase text-[0.625rem] tracking-wider border-b border-neutral-800">
                <tr>
                  <th className="px-4 py-2.5">Rank</th>
                  <th className="px-4 py-2.5">Menu Item</th>
                  <th className="px-4 py-2.5 text-right">Units Sold</th>
                  <th className="px-4 py-2.5 text-right">Gross Sales</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60 text-neutral-200">
                {topItems.map((item: any, idx: number) => (
                  <tr key={idx} className="hover:bg-neutral-850/50">
                    <td className="px-4 py-2.5 font-bold text-amber-400 font-mono">#{idx + 1}</td>
                    <td className="px-4 py-2.5 font-semibold text-white">{item.name}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{item.quantity}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-emerald-400">
                      GH₵{item.revenue.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 4: Complimentary order audit trail */}
        {compOrders.length > 0 && (
          <div className="bg-neutral-900 border border-amber-500/25 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 bg-neutral-850 border-b border-neutral-800 flex justify-between items-center">
              <h3 className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                Complimentary Orders (GH₵0.00 bills)
              </h3>
              <span className="text-[0.6875rem] text-neutral-400 font-mono">
                {compOrders.length} order{compOrders.length === 1 ? "" : "s"} · GH₵
                {Number(summary.totalCompValue || 0).toFixed(2)} value given free
              </span>
            </div>
            <div className="md:hidden divide-y divide-neutral-800/70">
              {compOrders.map((c: any) => (
                <div key={c.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-mono font-bold text-white text-sm break-all">{c.orderNumber}</div>
                      <div className="text-[0.6875rem] text-neutral-400">
                        {new Date(c.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="shrink-0 font-mono font-bold text-amber-400">
                      GH₵{Number(c.compValue || 0).toFixed(2)}
                    </div>
                  </div>
                  <div className="text-[0.6875rem] text-neutral-300">
                    <span className="text-neutral-500">Guest:</span> {c.customerName || "—"}
                  </div>
                  <div className="text-[0.6875rem] text-amber-300/90">
                    <span className="text-neutral-500">Reason:</span> {c.reason || "—"}
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-850 text-neutral-400 uppercase text-[0.625rem] tracking-wider border-b border-neutral-800">
                  <tr>
                    <th className="px-4 py-2.5">Order #</th>
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-4 py-2.5">Guest</th>
                    <th className="px-4 py-2.5">Reason</th>
                    <th className="px-4 py-2.5 text-right">Value Forgone</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60 text-neutral-200">
                  {compOrders.map((c: any) => (
                    <tr key={c.id} className="hover:bg-neutral-850/50">
                      <td className="px-4 py-2.5 font-mono font-bold text-white">{c.orderNumber}</td>
                      <td className="px-4 py-2.5 text-neutral-400 text-[0.6875rem]">
                        {new Date(c.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-neutral-200">{c.customerName || "—"}</td>
                      <td className="px-4 py-2.5 text-amber-300/90">{c.reason || "—"}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-amber-400">
                        GH₵{Number(c.compValue || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
