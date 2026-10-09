"use client";

import React, { useState, useEffect } from "react";
import { FileText, Search, Shield, RefreshCw } from "lucide-react";

export const AuditLogsViewer: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  const fetchLogs = async () => {
    try {
      const res = await fetch("/api/audit-logs?limit=100");
      const data = await res.json();
      if (data.logs) setLogs(data.logs);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter(
    (l) =>
      !search ||
      l.action.toLowerCase().includes(search.toLowerCase()) ||
      l.details?.toLowerCase().includes(search.toLowerCase()) ||
      l.userName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-neutral-950 overflow-hidden">
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

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-850 text-neutral-400 uppercase text-[10px] tracking-wider border-b border-neutral-800">
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
                  <td className="px-4 py-2.5 font-mono text-[11px] text-neutral-400">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 font-semibold text-white">
                    {log.userName || "System"}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="px-2 py-0.5 rounded-md bg-neutral-800 text-[10px] font-mono font-semibold text-amber-400">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 capitalize text-neutral-400">{log.entityType}</td>
                  <td className="px-4 py-2.5 text-neutral-300 text-[11px]">{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
