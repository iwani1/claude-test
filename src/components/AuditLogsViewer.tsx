"use client";

import { LoadFailure } from "./LoadFailure";
import { AuditDateRangePicker, type AuditDateRange } from "./AuditDateRangePicker";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { Search, Shield, RefreshCw } from "lucide-react";
import { ScrollFadeList } from "@/components/interface-studies";

type AuditLog = {
  id: number;
  action: string;
  entityType: string;
  userName: string | null;
  details: string | null;
  createdAt: string;
};
const PAGE_SIZE = 100;
const ghTime = (date: string) => new Date(date).toLocaleString("en-GH", { timeZone: "Africa/Accra" });

export const AuditLogsViewer: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState("");
  const [range, setRange] = useState<AuditDateRange>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const requestId = useRef(0);

  const fetchLogs = useCallback(async (offset = 0, append = false) => {
    const id = ++requestId.current;
    setLoading(true);
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
    if (range) { params.set("from", range.from); params.set("to", range.to); }
    try {
      const response = await fetch(`/api/audit-logs?${params}`);
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      const data = await response.json();
      if (id !== requestId.current) return; // a newer range/refresh won
      setLogs((previous) => append ? [...previous, ...data.logs] : data.logs);
      setHasMore(data.hasMore === true);
      setLoadError(null);
    } catch {
      if (id === requestId.current) setLoadError("Audit logs could not be loaded. What is shown may be out of date.");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    requestId.current++; // invalidate an older range before scheduling this one
    const kick = setTimeout(() => { void fetchLogs(); }, 0);
    return () => { clearTimeout(kick); };
  }, [fetchLogs]);

  const applyRange = (next: AuditDateRange) => {
    requestId.current++;
    setLogs([]);
    setSearch("");
    setHasMore(false);
    setLoadError(null);
    setLoading(true);
    setRange(next);
    // Clearing an already-clear range still refreshes the recent list.
    if (!next && !range) void fetchLogs();
  };

  const needle = search.toLowerCase();
  const filteredLogs = logs.filter((log) =>
    !needle || log.action.toLowerCase().includes(needle) ||
    log.details?.toLowerCase().includes(needle) ||
    log.userName?.toLowerCase().includes(needle)
  );
  const emptyText = search ? "No entries match this search in the loaded results." :
    range ? "No audit entries in this date range." : "No audit entries yet.";

  return (
    <div className="flex-1 flex flex-col h-full bg-neutral-950 overflow-hidden">
      <LoadFailure message={loadError} onRetry={() => { void fetchLogs(); }} />
      <div className="p-4 bg-neutral-900 border-b border-neutral-800 space-y-3">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-amber-500" />
              <span>Audit &amp; Security Event Trail</span>
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Branch activity: sign-ins, refunds, cash adjustments, and inventory commits
            </p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Search aria-hidden="true" className="w-4 h-4 absolute top-3.5 left-3 text-neutral-400" />
              <input type="search" placeholder="Search loaded entries..." aria-label="Search loaded audit entries"
                value={search} onChange={(e) => setSearch(e.target.value)}
                className="min-h-11 w-full sm:w-56 pl-9 pr-3 bg-neutral-800 border border-neutral-700 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500" />
            </div>
            <button type="button" onClick={() => { void fetchLogs(); }} aria-label="Refresh audit entries"
              className="min-h-11 min-w-11 flex items-center justify-center bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl border border-neutral-700">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
        <AuditDateRangePicker label="Audit logs" onApply={applyRange} />
        <p className="text-xs text-amber-200" aria-live="polite">
          {range ? `Showing ${range.from} to ${range.to} (Ghana time)` : "Showing recent entries (all dates)"}
          {` · ${logs.length} loaded`}{hasMore ? " · older entries available" : ""}
          {loading ? " · Loading…" : ""}
        </p>
      </div>

      <ScrollFadeList className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="md:hidden divide-y divide-neutral-800/70">
            {filteredLogs.length === 0 && !loading ? (
              <div className="p-8 text-center text-neutral-500 text-sm">{emptyText}</div>
            ) : filteredLogs.map((log) => (
              <div key={log.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <span className="px-2 py-1 rounded-md bg-neutral-800 text-[0.6875rem] font-mono font-semibold text-amber-400">{log.action}</span>
                  <span className="text-[0.6875rem] text-neutral-400 font-mono shrink-0">{ghTime(log.createdAt)}</span>
                </div>
                <div className="text-[0.6875rem] text-neutral-300">
                  <span className="font-semibold text-white">{log.userName || "System"}</span>
                  <span className="text-neutral-500"> · </span>
                  <span className="capitalize">{log.entityType}</span>
                </div>
                <div className="text-[0.6875rem] text-neutral-400 break-words">{log.details}</div>
              </div>
            ))}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-850 text-neutral-400 uppercase text-[0.625rem] tracking-wider border-b border-neutral-800">
                <tr>
                  <th className="px-4 py-3">Timestamp (Ghana)</th>
                  <th className="px-4 py-3">User / Operator</th>
                  <th className="px-4 py-3">Action Type</th>
                  <th className="px-4 py-3">Entity</th>
                  <th className="px-4 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60 text-neutral-300">
                {filteredLogs.length === 0 && !loading ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-neutral-500">{emptyText}</td></tr>
                ) : filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-neutral-850/50">
                    <td className="px-4 py-2.5 font-mono text-[0.6875rem] text-neutral-400 whitespace-nowrap">{ghTime(log.createdAt)}</td>
                    <td className="px-4 py-2.5 font-semibold text-white">{log.userName || "System"}</td>
                    <td className="px-4 py-2.5">
                      <span className="px-2 py-0.5 rounded-md bg-neutral-800 text-[0.625rem] font-mono font-semibold text-amber-400">{log.action}</span>
                    </td>
                    <td className="px-4 py-2.5 capitalize text-neutral-400">{log.entityType}</td>
                    <td className="px-4 py-2.5 text-neutral-300 text-[0.6875rem]">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {hasMore && <button type="button" disabled={loading} onClick={() => { void fetchLogs(logs.length, true); }}
          className="min-h-11 w-full mt-4 rounded-xl border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 text-amber-200 font-semibold text-sm disabled:opacity-50">
          {loading ? "Loading…" : `Load ${PAGE_SIZE} older entries`}
        </button>}
      </ScrollFadeList>
    </div>
  );
};
