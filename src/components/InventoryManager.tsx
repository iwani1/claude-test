"use client";

import React, { useState, useEffect } from "react";
import {
  Boxes,
  AlertTriangle,
  DollarSign,
  Plus,
  ArrowUpDown,
  History,
  ClipboardList,
  Search,
  Filter,
  CheckCircle,
  X,
  FileSpreadsheet,
} from "lucide-react";

export const InventoryManager: React.FC = () => {
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [totalValuation, setTotalValuation] = useState("0.00");
  const [lowStockCount, setLowStockCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [activeSubTab, setActiveSubTab] = useState<"stock" | "ledger" | "audit">("stock");

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState<any | null>(null);
  const [adjustDelta, setAdjustDelta] = useState<string>("");
  const [adjustType, setAdjustType] = useState<string>("adjustment");
  const [adjustReason, setAdjustReason] = useState<string>("");

  // New Ingredient state
  const [newName, setNewName] = useState("");
  const [newSku, setNewSku] = useState("");
  const [newCategory, setNewCategory] = useState("produce");
  const [newStock, setNewStock] = useState("");
  const [newMinStock, setNewMinStock] = useState("10");
  const [newUnit, setNewUnit] = useState("kg");
  const [newCost, setNewCost] = useState("");
  const [newLocation, setNewLocation] = useState("Main Walk-in Cooler");

  // Cycle count state
  const [auditItems, setAuditItems] = useState<Record<number, string>>({});
  const [auditNotes, setAuditNotes] = useState("");

  const fetchInventory = async () => {
    try {
      const res = await fetch("/api/inventory");
      const data = await res.json();
      if (data.ingredients) {
        setIngredients(data.ingredients);
        setMovements(data.movements || []);
        setTotalValuation(data.totalValuation || "0.00");
        setLowStockCount(data.lowStockCount || 0);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showAdjustModal || !adjustDelta) return;

    try {
      const deltaNum = Number(adjustDelta);
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "adjust_stock",
          ingredientId: showAdjustModal.id,
          delta: adjustType === "waste_spoilage" ? -Math.abs(deltaNum) : deltaNum,
          movementType: adjustType,
          reason: adjustReason,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setShowAdjustModal(null);
        setAdjustDelta("");
        setAdjustReason("");
        fetchInventory();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_ingredient",
          name: newName,
          sku: newSku,
          category: newCategory,
          currentStock: newStock || "0.000",
          minStockLevel: newMinStock || "5.000",
          unit: newUnit,
          costPerUnit: newCost || "0.00",
          location: newLocation,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowAddModal(false);
        setNewName("");
        setNewSku("");
        setNewStock("");
        setNewCost("");
        fetchInventory();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSubmitAudit = async (reconcile: boolean) => {
    const items = ingredients.map((ing) => {
      const physical = auditItems[ing.id] !== undefined ? Number(auditItems[ing.id]) : Number(ing.currentStock);
      const system = Number(ing.currentStock);
      const diff = physical - system;
      return {
        ingredientId: ing.id,
        name: ing.name,
        systemStock: system,
        physicalStock: physical,
        diff,
        costDiff: (diff * Number(ing.costPerUnit)).toFixed(2),
      };
    });

    try {
      const res = await fetch("/api/inventory/counts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          notes: auditNotes || "Weekly inventory audit",
          reconcileToSystem: reconcile,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert(reconcile ? "Physical stock count reconciled and system stock updated!" : "Cycle count saved!");
        setAuditItems({});
        setAuditNotes("");
        fetchInventory();
      }
    } catch {
      alert("Error saving count");
    }
  };

  const filteredIngredients = ingredients.filter((ing) => {
    const matchCat = categoryFilter === "all" || ing.category === categoryFilter;
    const matchSearch =
      !searchQuery ||
      ing.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ing.sku?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-neutral-950 overflow-hidden">
      {/* Top Banner with Key Metrics */}
      <div className="p-4 bg-neutral-900 border-b border-neutral-800 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Boxes className="w-5 h-5 text-amber-500" />
            <span>Raw Ingredient Inventory & Stock Control</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Recipe deductions, lot tracking, spoilage logs, and cost valuation
          </p>
        </div>

        {/* Metric Badges */}
        <div className="flex items-center gap-2 sm:gap-3 text-xs">
          <div className="px-3 py-1.5 rounded-xl bg-neutral-800 border border-neutral-700">
            <span className="text-[10px] text-neutral-400 uppercase font-semibold block">
              Total Valuation
            </span>
            <span className="text-emerald-400 font-mono font-bold text-sm">
              GH₵{Number(totalValuation).toLocaleString()}
            </span>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-neutral-800 border border-neutral-700">
            <span className="text-[10px] text-neutral-400 uppercase font-semibold block">
              Low Stock Alerts
            </span>
            <span
              className={`font-mono font-bold text-sm ${
                lowStockCount > 0 ? "text-rose-400" : "text-neutral-200"
              }`}
            >
              {lowStockCount} items
            </span>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl flex items-center gap-1.5 text-xs shadow-md shadow-amber-500/20 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add Ingredient</span>
          </button>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="px-4 py-2.5 bg-neutral-900/60 border-b border-neutral-800 flex items-center justify-between gap-4">
        <div className="flex gap-2 text-xs">
          <button
            onClick={() => setActiveSubTab("stock")}
            className={`px-3 py-1.5 rounded-lg font-semibold transition ${
              activeSubTab === "stock"
                ? "bg-amber-500 text-black"
                : "bg-neutral-800 text-neutral-300 hover:bg-neutral-750"
            }`}
          >
            Ingredient Stock List ({ingredients.length})
          </button>
          <button
            onClick={() => setActiveSubTab("ledger")}
            className={`px-3 py-1.5 rounded-lg font-semibold transition flex items-center gap-1.5 ${
              activeSubTab === "ledger"
                ? "bg-amber-500 text-black"
                : "bg-neutral-800 text-neutral-300 hover:bg-neutral-750"
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Stock Movement Ledger</span>
          </button>
          <button
            onClick={() => setActiveSubTab("audit")}
            className={`px-3 py-1.5 rounded-lg font-semibold transition flex items-center gap-1.5 ${
              activeSubTab === "audit"
                ? "bg-amber-500 text-black"
                : "bg-neutral-800 text-neutral-300 hover:bg-neutral-750"
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            <span>Cycle Count Audit</span>
          </button>
        </div>

        {activeSubTab === "stock" && (
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search ingredients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1 bg-neutral-800 border border-neutral-700 rounded-lg text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-2.5 py-1 bg-neutral-800 border border-neutral-700 rounded-lg text-xs text-white focus:outline-none"
            >
              <option value="all">All Categories</option>
              <option value="meat">Meat & Seafood</option>
              <option value="dairy">Dairy</option>
              <option value="produce">Produce</option>
              <option value="dry_goods">Dry Goods & Baking</option>
              <option value="beverage">Beverage & Bar</option>
            </select>
          </div>
        )}
      </div>

      {/* Main Content Areas */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {/* VIEW 1: Ingredient Stock Table */}
        {activeSubTab === "stock" && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-850 text-neutral-400 uppercase text-[10px] tracking-wider border-b border-neutral-800">
                  <tr>
                    <th className="px-4 py-3">Ingredient</th>
                    <th className="px-4 py-3">SKU</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3 text-right">Current Stock</th>
                    <th className="px-4 py-3 text-right">Min Threshold</th>
                    <th className="px-4 py-3 text-right">Unit Cost</th>
                    <th className="px-4 py-3 text-right">Valuation</th>
                    <th className="px-4 py-3">Location</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60 text-neutral-200">
                  {filteredIngredients.map((ing) => {
                    const isLow = ing.isLowStock;
                    return (
                      <tr
                        key={ing.id}
                        className={`hover:bg-neutral-850/50 transition ${
                          isLow ? "bg-rose-950/10" : ""
                        }`}
                      >
                        <td className="px-4 py-3 font-semibold text-white">
                          <div className="flex items-center gap-2">
                            <span>{ing.name}</span>
                            {isLow && (
                              <span className="px-1.5 py-0.5 rounded-xs bg-rose-500/20 text-rose-300 text-[9px] font-bold uppercase tracking-wider border border-rose-500/40">
                                Low
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-neutral-400">{ing.sku || "—"}</td>
                        <td className="px-4 py-3 capitalize text-neutral-300">{ing.category}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-white">
                          {Number(ing.currentStock).toFixed(3)} {ing.unit}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-neutral-400">
                          {Number(ing.minStockLevel).toFixed(1)} {ing.unit}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-neutral-300">
                          GH₵{Number(ing.costPerUnit).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-emerald-400">
                          GH₵{ing.valuation}
                        </td>
                        <td className="px-4 py-3 text-neutral-400">{ing.location || "Storage"}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => {
                              setShowAdjustModal(ing);
                              setAdjustDelta("");
                              setAdjustType("adjustment");
                            }}
                            className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-amber-400 hover:text-amber-300 font-semibold rounded-md text-[11px] border border-neutral-700 transition"
                          >
                            Adjust Stock
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VIEW 2: Movement Ledger */}
        {activeSubTab === "ledger" && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-3 bg-neutral-850 border-b border-neutral-800 flex justify-between items-center text-xs">
              <span className="font-semibold text-neutral-200">
                Audit Trail of Automatic & Manual Stock Deductions
              </span>
              <span className="text-neutral-400">Showing latest 50 movements</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-850 text-neutral-400 uppercase text-[10px] tracking-wider border-b border-neutral-800">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Ingredient</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3 text-right">Change</th>
                    <th className="px-4 py-3 text-right">Prev Stock</th>
                    <th className="px-4 py-3 text-right">New Stock</th>
                    <th className="px-4 py-3">Reference / Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60 text-neutral-300 font-mono">
                  {movements.map((m) => {
                    const delta = Number(m.quantityDelta);
                    const isPositive = delta > 0;
                    return (
                      <tr key={m.id} className="hover:bg-neutral-850/50">
                        <td className="px-4 py-2.5 text-neutral-400 text-[11px]">
                          {new Date(m.createdAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5 font-sans font-semibold text-white">
                          {ingredients.find((i) => i.id === m.ingredientId)?.name || `#${m.ingredientId}`}
                        </td>
                        <td className="px-4 py-2.5 font-sans capitalize text-[11px]">
                          <span
                            className={`px-2 py-0.5 rounded-md ${
                              m.movementType === "order_deduction"
                                ? "bg-amber-500/10 text-amber-300"
                                : m.movementType === "purchase_receipt"
                                ? "bg-emerald-500/10 text-emerald-300"
                                : m.movementType === "waste_spoilage"
                                ? "bg-rose-500/10 text-rose-300"
                                : "bg-neutral-800 text-neutral-300"
                            }`}
                          >
                            {m.movementType.replace("_", " ")}
                          </span>
                        </td>
                        <td
                          className={`px-4 py-2.5 text-right font-bold ${
                            isPositive ? "text-emerald-400" : "text-amber-400"
                          }`}
                        >
                          {isPositive ? `+${delta.toFixed(3)}` : delta.toFixed(3)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-neutral-400">
                          {Number(m.previousStock).toFixed(3)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-white">
                          {Number(m.newStock).toFixed(3)}
                        </td>
                        <td className="px-4 py-2.5 font-sans text-neutral-400 text-[11px]">
                          {m.referenceId && <span className="font-mono text-neutral-300 mr-2">{m.referenceId}:</span>}
                          {m.reason}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VIEW 3: Physical Cycle Count Audit */}
        {activeSubTab === "audit" && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-base font-bold text-white">
                  Physical Inventory Stocktake & Reconciliation
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Input actual shelf counts to compute variance and adjust the system ledger
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleSubmitAudit(false)}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-750 text-neutral-200 text-xs font-semibold rounded-xl border border-neutral-700"
                >
                  Save Count Only
                </button>
                <button
                  onClick={() => handleSubmitAudit(true)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-md shadow-emerald-600/20"
                >
                  Reconcile & Update System Stock
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-850 text-neutral-400 uppercase text-[10px] tracking-wider border-b border-neutral-800">
                  <tr>
                    <th className="px-4 py-2.5">Ingredient</th>
                    <th className="px-4 py-2.5">Category</th>
                    <th className="px-4 py-2.5 text-right">System Stock</th>
                    <th className="px-4 py-2.5 text-right">Physical Count</th>
                    <th className="px-4 py-2.5 text-right">Variance</th>
                    <th className="px-4 py-2.5 text-right">Valuation Diff</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60 text-neutral-200">
                  {ingredients.map((ing) => {
                    const physicalVal = auditItems[ing.id] !== undefined ? auditItems[ing.id] : String(Number(ing.currentStock));
                    const systemNum = Number(ing.currentStock);
                    const physicalNum = Number(physicalVal || 0);
                    const diff = physicalNum - systemNum;
                    const valDiff = diff * Number(ing.costPerUnit);

                    return (
                      <tr key={ing.id} className="hover:bg-neutral-850/40">
                        <td className="px-4 py-2.5 font-semibold text-white">{ing.name}</td>
                        <td className="px-4 py-2.5 capitalize text-neutral-400">{ing.category}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-neutral-300">
                          {systemNum.toFixed(3)} {ing.unit}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <input
                            type="number"
                            step="0.001"
                            value={physicalVal}
                            onChange={(e) =>
                              setAuditItems({
                                ...auditItems,
                                [ing.id]: e.target.value,
                              })
                            }
                            className="w-24 text-right bg-neutral-800 border border-neutral-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-amber-500 font-mono font-bold"
                          />
                        </td>
                        <td
                          className={`px-4 py-2.5 text-right font-mono font-bold ${
                            Math.abs(diff) < 0.001
                              ? "text-neutral-500"
                              : diff > 0
                              ? "text-emerald-400"
                              : "text-rose-400"
                          }`}
                        >
                          {diff > 0 ? `+${diff.toFixed(3)}` : diff.toFixed(3)} {ing.unit}
                        </td>
                        <td
                          className={`px-4 py-2.5 text-right font-mono ${
                            Math.abs(valDiff) < 0.01
                              ? "text-neutral-500"
                              : valDiff > 0
                              ? "text-emerald-400"
                              : "text-rose-400"
                          }`}
                        >
                          GH₵{valDiff.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: Adjust Stock */}
      {showAdjustModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <form
            onSubmit={handleAdjustStock}
            className="bg-neutral-900 border border-neutral-700 rounded-2xl p-5 w-full max-w-sm shadow-2xl space-y-4"
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-sm font-bold text-white">Adjust Stock</h3>
                <p className="text-xs text-amber-400 mt-0.5">{showAdjustModal.name}</p>
                <p className="text-[11px] text-neutral-400 font-mono">
                  Current: {Number(showAdjustModal.currentStock).toFixed(3)} {showAdjustModal.unit}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAdjustModal(null)}
                className="text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-neutral-300 block mb-1">Adjustment Type</label>
                <select
                  value={adjustType}
                  onChange={(e) => setAdjustType(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white"
                >
                  <option value="adjustment">General Adjustment (+/-)</option>
                  <option value="waste_spoilage">Waste / Spoilage / Expired (Minus)</option>
                  <option value="purchase_receipt">Direct Receipt / Delivery (Plus)</option>
                </select>
              </div>

              <div>
                <label className="text-neutral-300 block mb-1">
                  Quantity ({showAdjustModal.unit})
                </label>
                <input
                  type="number"
                  step="0.001"
                  required
                  placeholder="e.g. 5 or -2.5"
                  value={adjustDelta}
                  onChange={(e) => setAdjustDelta(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="text-neutral-300 block mb-1">Reason / Notes</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Damaged box, dropped, or weekly count"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setShowAdjustModal(null)}
                className="px-3 py-1.5 text-xs text-neutral-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-semibold bg-amber-500 text-black rounded-lg"
              >
                Commit Adjustment
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 2: Add Ingredient */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <form
            onSubmit={handleAddIngredient}
            className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4"
          >
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-white">Create New Ingredient</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="col-span-2">
                <label className="text-neutral-300 block mb-1">Ingredient Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Fresh Atlantic Cod"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="text-neutral-300 block mb-1">SKU / Code</label>
                <input
                  type="text"
                  placeholder="ING-COD-01"
                  value={newSku}
                  onChange={(e) => setNewSku(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="text-neutral-300 block mb-1">Category</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white"
                >
                  <option value="meat">Meat & Seafood</option>
                  <option value="dairy">Dairy</option>
                  <option value="produce">Produce</option>
                  <option value="dry_goods">Dry Goods</option>
                  <option value="beverage">Beverage & Liquor</option>
                </select>
              </div>

              <div>
                <label className="text-neutral-300 block mb-1">Starting Stock</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="20"
                  value={newStock}
                  onChange={(e) => setNewStock(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="text-neutral-300 block mb-1">Unit of Measure</label>
                <select
                  value={newUnit}
                  onChange={(e) => setNewUnit(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white"
                >
                  <option value="kg">kg (Kilogram)</option>
                  <option value="g">g (Gram)</option>
                  <option value="liter">liter</option>
                  <option value="ml">ml (Milliliter)</option>
                  <option value="pcs">pcs (Pieces)</option>
                  <option value="bottle">bottle</option>
                  <option value="box">box</option>
                </select>
              </div>

              <div>
                <label className="text-neutral-300 block mb-1">Unit Cost ($)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="12.50"
                  value={newCost}
                  onChange={(e) => setNewCost(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="text-neutral-300 block mb-1">Min Alert Stock</label>
                <input
                  type="number"
                  step="0.1"
                  value={newMinStock}
                  onChange={(e) => setNewMinStock(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-3 py-1.5 text-xs text-neutral-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-semibold bg-amber-500 text-black rounded-lg"
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
