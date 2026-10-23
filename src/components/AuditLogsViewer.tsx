"use client";

import { LoadFailure } from "./LoadFailure";

import React, { useState, useEffect, useCallback } from "react";
import { FileText, Search, Shield, RefreshCw } from "lucide-react";
import { ScrollFadeList } from "@/components/interface-studies";

export const AuditLogsViewer: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchLogs = useCallback(() => fetch("/api/audit-logs?limit=100")
    .then(res => { if (!res.ok) throw new Error("Request failed"); return res.json(); })
    .then(data => {
    setLoadError(null);
      if (data.logs) setLogs(data.logs);

    }).catch(() => setLoadError("Audit logs could not be loaded. What is shown may be out of date.")), []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const filteredLogs = logs.filter(
    (l) =>
      !search ||
      l.action.toLowerCase().includes(search.toLowerCase()) ||
      l.details?.toLowerCase().includes(search.toLowerCase()) ||
      l.userName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-neutral-950 overflow-hidden">
      <LoadFailure message={loadError} onRetry={fetchLogs} />
      <div className="p-4 bg-neutral-900 border-b border-neutral-800 flex justify-between items-center">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-500" />
            <span>Audit & Security Event Trail</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Tamper-evident logs of logins, refunds, cash adjustments, and inventory commits
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search audit trail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-3 pr-3 py-1.5 bg-neutral-800 border border-neutral-700 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
          />
          <button
            onClick={fetchLogs}
            className="p-1.5 bg-neutral-800 hover:bg-neutral-750 text-neutral-300 rounded-lg border border-neutral-700"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <ScrollFadeList className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="md:hidden divide-y divide-neutral-800/70">
            {filteredLogs.length === 0 ? (
              <div className="p-8 text-center text-neutral-500 text-sm">
                No audit entries match this filter.
              </div>
            ) : (
              filteredLogs.map((log) => (
                <div key={log.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <span className="px-2 py-1 rounded-md bg-neutral-800 text-[0.6875rem] font-mono font-semibold text-amber-400">
                      {log.action}
                    </span>
                    <span className="text-[0.6875rem] text-neutral-400 font-mono shrink-0">
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-[0.6875rem] text-neutral-300">
                    <span className="font-semibold text-white">{log.userName || "System"}</span>
                    <span className="text-neutral-500"> · </span>
                    <span className="capitalize">{log.entityType}</span>
                  </div>
                  <div className="text-[0.6875rem] text-neutral-400 break-words">{log.details}</div>
                </div>
              ))
            )}
          </div>

          <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-850 text-neutral-400 uppercase text-[0.625rem] tracking-wider border-b border-neutral-800">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">User / Operator</th>
                <th className="px-4 py-3">Action Type</th>
                <th className="px-4 py-3">Entity</th>
                <th className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60 text-neutral-300">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-neutral-850/50">
                  <td className="px-4 py-2.5 font-mono text-[0.6875rem] text-neutral-400">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 font-semibold text-white">
                    {log.userName || "System"}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="px-2 py-0.5 rounded-md bg-neutral-800 text-[0.625rem] font-mono font-semibold text-amber-400">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 capitalize text-neutral-400">{log.entityType}</td>
                  <td className="px-4 py-2.5 text-neutral-300 text-[0.6875rem]">{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </ScrollFadeList>
    </div>
  );
};
