"use client";

import React, { useState } from "react";
import {
  Grid,
  Users,
  Clock,
  Plus,
  ArrowRightLeft,
  Sparkles,
  CheckCircle,
  AlertTriangle,
  Receipt,
  Utensils,
  X,
} from "lucide-react";
import { apiErrorMessage, apiFetch } from "@/lib/api-client";
import { notify } from "@/lib/notify";

interface TableFloorPlanProps {
  areas: any[];
  tables: any[];
  onOpenPosForTable: (tableId: number) => void;
  onRefresh: () => void;
}

export const TableFloorPlan: React.FC<TableFloorPlanProps> = ({
  areas,
  tables,
  onOpenPosForTable,
  onRefresh,
}) => {
  const [selectedAreaId, setSelectedAreaId] = useState<number | "all">("all");
  const [movingTable, setMovingTable] = useState<any | null>(null);
  const [targetTableId, setTargetTableId] = useState<number | "">("");
  const [showAddTableModal, setShowAddTableModal] = useState(false);
  const [newTableNumber, setNewTableNumber] = useState("");
  const [newTableCapacity, setNewTableCapacity] = useState(4);
  const [newTableAreaId, setNewTableAreaId] = useState<number>(areas[0]?.id || 1);

  const filteredTables = tables.filter(
    (t) => selectedAreaId === "all" || t.areaId === selectedAreaId
  );

  const handleUpdateStatus = async (tableId: number, status: string) => {
    try {
      const res = await fetch("/api/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_status", tableId, status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        notify(data.error || "Table status was not changed", "error");
        return;
      }
      onRefresh();
    } catch (e) {
      console.error(e);
      notify(apiErrorMessage(e, "Could not reach the server. Table status was not changed."), "error");
    }
  };

  const handleMoveOrder = async () => {
    if (!movingTable || !targetTableId) return;
    try {
      const data = await apiFetch("/api/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "move_table",
          sourceTableId: movingTable.id,
          targetTableId: Number(targetTableId),
        }),
      });
      if (data.success) {
        setMovingTable(null);
        setTargetTableId("");
        onRefresh();
      } else {
        notify(data.error || "Failed to move table", "error");
      }
    } catch (e) {
      notify(apiErrorMessage(e, "Error moving table"), "error");
    }
  };

  const handleAddTable = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = await apiFetch("/api/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_table",
          areaId: newTableAreaId,
          tableNumber: newTableNumber,
          capacity: newTableCapacity,
        }),
      });
      if (data.success) {
        setShowAddTableModal(false);
        setNewTableNumber("");
        onRefresh();
      } else {
        notify(data.error || "Table was not created", "error");
      }
    } catch (e) {
      console.error(e);
      notify(apiErrorMessage(e, "Could not reach the server. Table was not created."), "error");
    }
  };

  // Status counts
  const availableCount = tables.filter((t) => t.status === "available").length;
  const occupiedCount = tables.filter((t) => t.status === "occupied").length;
  const reservedCount = tables.filter((t) => t.status === "reserved").length;
  const cleaningCount = tables.filter((t) => t.status === "cleaning").length;

  return (
    <div className="flex-1 flex flex-col h-full bg-neutral-950 overflow-hidden">
      {/* Top Header Bar */}
      <div className="p-4 bg-neutral-900 border-b border-neutral-800 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Grid className="w-5 h-5 text-amber-500" />
            <span>Dining Room & Table Management</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Real-time floor occupancy, customer assignments, and table turnover
          </p>
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Available ({availableCount})</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 font-semibold">
            <span className="w-2 h-2 rounded-full bg-rose-400" />
            <span>Occupied ({occupiedCount})</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-400 font-semibold">
            <span className="w-2 h-2 rounded-full bg-sky-400" />
            <span>Reserved ({reservedCount})</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 font-semibold">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span>Cleaning ({cleaningCount})</span>
          </div>

          <button
            onClick={() => setShowAddTableModal(true)}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg flex items-center gap-1 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Table</span>
          </button>
        </div>
      </div>

      {/* Dining Area Tabs */}
      <div className="px-4 py-2.5 bg-neutral-900/60 border-b border-neutral-800 flex items-center gap-2 overflow-x-auto custom-scrollbar">
        <button
          onClick={() => setSelectedAreaId("all")}
          className={`px-4 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
            selectedAreaId === "all"
              ? "bg-amber-500 text-black shadow-xs"
              : "bg-neutral-800 text-neutral-300 hover:bg-neutral-750"
          }`}
        >
          All Dining Areas ({tables.length})
        </button>
        {areas.map((a) => (
          <button
            key={a.id}
            onClick={() => setSelectedAreaId(a.id)}
            className={`px-4 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
              selectedAreaId === a.id
                ? "bg-amber-500 text-black shadow-xs"
                : "bg-neutral-800 text-neutral-300 hover:bg-neutral-750"
            }`}
          >
            {a.name}
          </button>
        ))}
      </div>

      {/* Tables Grid */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filteredTables.map((tbl) => {
            const isOccupied = tbl.status === "occupied";
            const isAvailable = tbl.status === "available";
            const isReserved = tbl.status === "reserved";
            const isCleaning = tbl.status === "cleaning";

            const borderColor = isOccupied
              ? "border-rose-500/50 hover:border-rose-400"
              : isAvailable
              ? "border-emerald-500/40 hover:border-emerald-400"
              : isReserved
              ? "border-sky-500/40 hover:border-sky-400"
              : "border-amber-500/40 hover:border-amber-400";

            return (
              <div
                key={tbl.id}
                className={`bg-neutral-900 border ${borderColor} rounded-2xl p-4 flex flex-col justify-between shadow-lg transition-all duration-150 hover:shadow-2xl`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono font-bold text-base text-white">
                      {tbl.tableNumber}
                    </span>
                    <span className="flex items-center gap-1 text-[0.6875rem] text-neutral-400">
                      <Users className="w-3.5 h-3.5" />
                      <span>{tbl.capacity}p</span>
                    </span>
                  </div>

                  {/* Status Indicator */}
                  <div className="mb-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-md text-[0.6875rem] font-bold capitalize ${
                        isOccupied
                          ? "bg-rose-500/20 text-rose-300"
                          : isAvailable
                          ? "bg-emerald-500/20 text-emerald-300"
                          : isReserved
                          ? "bg-sky-500/20 text-sky-300"
                          : "bg-amber-500/20 text-amber-300"
                      }`}
                    >
                      {tbl.status}
                    </span>
                  </div>

                  {/* Active Order Details if occupied */}
                  {isOccupied && tbl.activeOrder && (
                    <div className="p-2.5 bg-neutral-950/80 rounded-xl border border-neutral-800 text-xs space-y-1 mb-3">
                      <div className="font-semibold text-neutral-200 truncate">
                        {tbl.activeOrder.customerName || "Dine-in Guest"}
                      </div>
                      <div className="flex justify-between text-[0.6875rem] text-neutral-400 font-mono">
                        <span>{tbl.activeOrder.orderNumber}</span>
                        <span className="text-amber-400 font-bold">
                          GH₵{Number(tbl.activeOrder.totalAmount).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Table Action Buttons */}
                <div className="space-y-1.5 pt-2 border-t border-neutral-800 text-xs">
                  <button
                    onClick={() => onOpenPosForTable(tbl.id)}
                    className="w-full py-1.5 bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-black font-semibold rounded-lg transition flex items-center justify-center gap-1.5"
                  >
                    <Utensils className="w-3.5 h-3.5" />
                    <span>{isOccupied ? "View / Add Bill" : "Open Table"}</span>
                  </button>

                  <div className="flex gap-1">
                    {isOccupied ? (
                      <>
                        <button
                          onClick={() => setMovingTable(tbl)}
                          className="flex-1 py-1 rounded-md bg-neutral-800 hover:bg-neutral-750 text-neutral-300 text-[0.625rem] flex items-center justify-center gap-1 transition"
                          title="Move order to another table"
                        >
                          <ArrowRightLeft className="w-3 h-3 text-sky-400" />
                          <span>Move</span>
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(tbl.id, "cleaning")}
                          className="flex-1 py-1 rounded-md bg-neutral-800 hover:bg-neutral-750 text-neutral-300 text-[0.625rem] transition"
                        >
                          Clean
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() =>
                            handleUpdateStatus(
                              tbl.id,
                              isAvailable ? "reserved" : "available"
                            )
                          }
                          className="flex-1 py-1 rounded-md bg-neutral-800 hover:bg-neutral-750 text-neutral-300 text-[0.625rem] transition"
                        >
                          {isReserved ? "Available" : "Reserve"}
                        </button>
                        {isCleaning && (
                          <button
                            onClick={() => handleUpdateStatus(tbl.id, "available")}
                            className="flex-1 py-1 rounded-md bg-emerald-500/20 text-emerald-300 text-[0.625rem] font-semibold transition"
                          >
                            Ready
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MODAL: Move Table */}
      {movingTable && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-5 w-full max-w-sm shadow-2xl space-y-4 max-h-[92dvh] overflow-y-auto my-auto">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-amber-400" />
              <span>Move Table {movingTable.tableNumber}</span>
            </h3>
            <p className="text-xs text-neutral-400">
              Transfer active customer bill to an available table
            </p>

            <div>
              <label className="text-xs text-neutral-300 block mb-1">Target Table</label>
              <select
                value={targetTableId}
                onChange={(e) => setTargetTableId(Number(e.target.value))}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              >
                <option value="">Choose target table...</option>
                {tables
                  .filter((t) => t.id !== movingTable.id && t.status === "available")
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.tableNumber} ({t.capacity} seats)
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
              <button
                onClick={() => setMovingTable(null)}
                className="px-3 py-1.5 text-xs text-neutral-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleMoveOrder}
                disabled={!targetTableId}
                className="px-4 py-1.5 text-xs font-semibold bg-amber-500 text-black disabled:opacity-40 rounded-lg"
              >
                Confirm Move
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Add Table */}
      {showAddTableModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto">
          <form
            onSubmit={handleAddTable}
            className="bg-neutral-900 border border-neutral-700 rounded-2xl p-5 w-full max-w-sm shadow-2xl space-y-4 max-h-[92dvh] overflow-y-auto my-auto"
          >
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-white">Add New Table</h3>
              <button
                type="button"
                onClick={() => setShowAddTableModal(false)}
                className="text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-neutral-300 block mb-1">Dining Area</label>
                <select
                  value={newTableAreaId}
                  onChange={(e) => setNewTableAreaId(Number(e.target.value))}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white"
                >
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-neutral-300 block mb-1">Table Label / Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. T-09 or PATIO-5"
                  value={newTableNumber}
                  onChange={(e) => setNewTableNumber(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-neutral-300 block mb-1">Seating Capacity</label>
                <input
                  type="number"
                        inputMode="decimal"
                  min={1}
                  max={24}
                  value={newTableCapacity}
                  onChange={(e) => setNewTableCapacity(Number(e.target.value))}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setShowAddTableModal(false)}
                className="px-3 py-1.5 text-xs text-neutral-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-semibold bg-amber-500 text-black rounded-lg"
              >
                Create Table
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
