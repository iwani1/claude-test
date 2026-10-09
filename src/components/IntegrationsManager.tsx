"use client";

import React, { useState } from "react";
import { Cable, Printer, Smartphone, QrCode, Coins, CheckCircle2, DollarSign, Download, FileSpreadsheet } from "lucide-react";

export const IntegrationsManager: React.FC = () => {
  const [printerIp, setPrinterIp] = useState("192.168.1.200:9100");
  const [printerStatus, setPrinterStatus] = useState<string | null>(null);

  const handleTestPrinter = async () => {
    setPrinterStatus("Sending ESC/POS raw socket payload...");
    try {
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test_thermal_printer",
          printerIp,
          testText: "Asanka Royal Kitchen Ticket & Docket Test\nCutter: PASS\nFeed: PASS\n",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPrinterStatus(data.message);
      }
    } catch {
      setPrinterStatus("Failed to reach printer bridge");
    }
  };

  const handleExportAccounting = async (format: "quickbooks" | "xero") => {
    try {
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "export_accounting", format }),
      });
      const data = await res.json();
      if (data.csvContent) {
        const blob = new Blob([data.csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `asanka_sales_journal_${format}_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch {
      alert("Failed to export accounting journal");
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-neutral-950 overflow-hidden">
      <div className="p-4 bg-neutral-900 border-b border-neutral-800">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Cable className="w-5 h-5 text-amber-500" />
          <span>Payment Tenders & Hardware Management</span>
        </h2>
        <p className="text-xs text-neutral-400 mt-0.5">
          Direct cashier-indicated Cash &amp; MoMo tenders (including Split payments) and ESC/POS thermal printing
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Ghanaian Tender Methods: Direct Indication */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Payment Tenders Configuration</h3>
                <p className="text-xs text-neutral-400">Direct Staff Indication • No Telecom Gateway Delay</p>
              </div>
            </div>

            <div className="p-3 bg-neutral-850 rounded-xl border border-neutral-800 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Zero gateway dependencies — 100% reliable at checkout</span>
              </div>
              <p className="text-neutral-400 text-[11px] leading-relaxed">
                Staff simply select how the customer settled:
              </p>
              <div className="space-y-1.5 pt-1">
                <div className="flex items-start gap-2">
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[10px]">CASH</span>
                  <span className="text-neutral-300 text-[11px]">Exact physical cash tendered and automatic change calculation.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold text-[10px]">MOMO</span>
                  <span className="text-neutral-300 text-[11px]">Staff confirms customer transferred to restaurant MoMo or scanned GhQR.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold text-[10px]">SPLIT</span>
                  <span className="text-neutral-300 text-[11px]">Customer pays part in Cash and part via MoMo. Both amounts recorded!</span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-neutral-850 rounded-xl border border-neutral-800 space-y-2 text-xs">
              <span className="font-semibold text-neutral-300 block">Restaurant Receiving MoMo Accounts:</span>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2 bg-neutral-900 rounded-lg">
                  <span className="text-neutral-500 block">MTN MoMo / Merchant</span>
                  <span className="font-mono text-white font-bold">055 892 4410</span>
                </div>
                <div className="p-2 bg-neutral-900 rounded-lg">
                  <span className="text-neutral-500 block">GhQR Universal Code</span>
                  <span className="font-mono text-white font-bold">ASANKA-ACC-001</span>
                </div>
              </div>
            </div>
          </div>

          {/* Split Payment Support Details */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                <Coins className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Split Payment (Cash + MoMo)</h3>
                <p className="text-xs text-neutral-400">Integrated Till &amp; Shift Ledger Tracking</p>
              </div>
            </div>

            <div className="p-3 bg-neutral-850 rounded-xl border border-neutral-800 space-y-2.5 text-xs">
              <p className="text-neutral-300 text-[11px] leading-relaxed">
                When a customer pays with both Cash and Mobile Money:
              </p>
              <ul className="list-disc pl-4 space-y-1 text-neutral-400 text-[11px]">
                <li>Cashier enters the cash portion and MoMo portion in the POS settlement window.</li>
                <li>Physical cash portion adds to the register drawer balance and calculates cash change.</li>
                <li>MoMo portion adds to electronic sales for the shift.</li>
                <li>Customer receipt prints a clear itemized breakdown of both Cash and MoMo payments.</li>
              </ul>
            </div>

            <div className="p-3 bg-neutral-850 rounded-xl border border-neutral-800 flex justify-between items-center text-xs">
              <div className="space-y-0.5">
                <span className="font-semibold text-white block">Accounting Journal Export</span>
                <span className="text-[10px] text-neutral-400">Download formatted sales journals with Cash &amp; MoMo tender breakdown</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleExportAccounting("quickbooks")}
                  className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  <span>QuickBooks</span>
                </button>
                <button
                  onClick={() => handleExportAccounting("xero")}
                  className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
                >
                  <Download className="w-3.5 h-3.5 text-sky-400" />
                  <span>Xero</span>
                </button>
              </div>
            </div>
          </div>

          {/* Thermal Printer Bridge */}
          <div className="col-span-1 md:col-span-2 bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Printer className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">ESC/POS Thermal Receipt &amp; Kitchen Docket Printer</h3>
                <p className="text-xs text-neutral-400">Direct IP/Port 9100 or Browser Print Dialog for 80mm rolls</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="md:col-span-2">
                <label className="text-neutral-400 block mb-1">Printer IP &amp; Port</label>
                <input
                  type="text"
                  value={printerIp}
                  onChange={(e) => setPrinterIp(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div className="flex items-end">
                <button
                  onClick={handleTestPrinter}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition"
                >
                  Send ESC/POS Test Feed &amp; Cut
                </button>
              </div>
            </div>

            {printerStatus && (
              <div className="p-3 rounded-xl bg-neutral-850 border border-neutral-800 text-neutral-300 font-mono text-[11px]">
                {printerStatus}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
