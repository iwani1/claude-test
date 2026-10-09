"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Scroll,
  Plus,
  Trash2,
  DollarSign,
  ChefHat,
  Percent,
  CheckCircle2,
  AlertCircle,
  X,
  Layers,
} from "lucide-react";

export const RecipeManager: React.FC = () => {
  const [recipes, setRecipes] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [allIngredients, setAllIngredients] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);

  // New Recipe Form
  const [selectedMenuItemId, setSelectedMenuItemId] = useState<number | "">("");
  const [yieldCount, setYieldCount] = useState<number>(1);
  const [prepInstructions, setPrepInstructions] = useState("");
  const [recipeIngRows, setRecipeIngRows] = useState<
    { ingredientId: number | ""; quantity: string; unit: string }[]
  >([{ ingredientId: "", quantity: "1", unit: "pcs" }]);

  const fetchRecipes = useCallback(() => fetch("/api/inventory/recipes")
    .then(res => { if (!res.ok) throw new Error("Request failed"); return res.json(); })
    .then(data => {
      if (data.recipes) {
        setRecipes(data.recipes);
        setMenuItems(data.menuItems || []);
        setAllIngredients(data.allIngredients || []);
      }

    }).catch(console.error), []);

  useEffect(() => {
    fetchRecipes();
  }, [fetchRecipes]);

  const addIngRow = () => {
    setRecipeIngRows([...recipeIngRows, { ingredientId: "", quantity: "1", unit: "pcs" }]);
  };

  const removeIngRow = (idx: number) => {
    const updated = [...recipeIngRows];
    updated.splice(idx, 1);
    setRecipeIngRows(updated);
  };

  const updateIngRow = (idx: number, field: string, val: any) => {
    const updated = [...recipeIngRows];
    (updated[idx] as any)[field] = val;
    if (field === "ingredientId") {
      const ing = allIngredients.find((i) => i.id === Number(val));
      if (ing) updated[idx].unit = ing.unit;
    }
    setRecipeIngRows(updated);
  };

  const handleSaveRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMenuItemId) return;

    const validRows = recipeIngRows.filter((r) => r.ingredientId && Number(r.quantity) > 0);
    if (validRows.length === 0) {
      alert("At least one ingredient row is required");
      return;
    }

    try {
      const res = await fetch("/api/inventory/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          menuItemId: Number(selectedMenuItemId),
          yieldCount,
          prepInstructions,
          ingredients: validRows,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setShowAddModal(false);
        setSelectedMenuItemId("");
        setRecipeIngRows([{ ingredientId: "", quantity: "1", unit: "pcs" }]);
        setPrepInstructions("");
        fetchRecipes();
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-neutral-950 overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-neutral-900 border-b border-neutral-800 flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Scroll className="w-5 h-5 text-amber-500" />
            <span>Recipe Management & Food Cost Analysis</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Link finished dishes to raw ingredients for automatic inventory deduction and margins
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl flex items-center gap-1.5 text-xs shadow-md shadow-amber-500/20 transition"
        >
          <Plus className="w-4 h-4" />
          <span>New Recipe</span>
        </button>
      </div>

      {/* Recipes Cards Grid */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {recipes.map((rec) => {
            const cost = Number(rec.calculatedCost || rec.totalRecipeCost || 0);
            const price = Number(rec.itemPrice || 0);
            const foodCostPct = Number(rec.foodCostPercentage || 0);
            const margin = Number(rec.grossMargin || 0);

            return (
              <div
                key={rec.id}
                className="bg-neutral-900 border border-neutral-800 hover:border-neutral-700 rounded-2xl p-4 shadow-xl flex flex-col justify-between"
              >
                <div>
                  {/* Item Title & Price */}
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-bold text-white text-sm">{rec.itemName}</h4>
                      <p className="text-[11px] text-neutral-400 mt-0.5">
                        Yield: {rec.yieldCount} portion(s)
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-mono font-bold text-emerald-400">
                        GH₵{price.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-neutral-500">Menu Price</div>
                    </div>
                  </div>

                  {/* Profitability Bar */}
                  <div className="p-2.5 bg-neutral-950/80 rounded-xl border border-neutral-800 grid grid-cols-3 gap-2 text-center text-xs mb-3">
                    <div>
                      <span className="text-[10px] text-neutral-500 block uppercase">Recipe Cost</span>
                      <span className="font-mono font-bold text-neutral-200">
                        GH₵{cost.toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-neutral-500 block uppercase">Food Cost %</span>
                      <span
                        className={`font-mono font-bold ${
                          foodCostPct > 35 ? "text-rose-400" : "text-amber-400"
                        }`}
                      >
                        {foodCostPct}%
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-neutral-500 block uppercase">Gross Margin</span>
                      <span className="font-mono font-bold text-emerald-400">{margin}%</span>
                    </div>
                  </div>

                  {/* Ingredients Breakdown */}
                  <div className="space-y-1.5 mb-3">
                    <span className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider block">
                      Required Ingredients:
                    </span>
                    <div className="space-y-1 text-xs">
                      {rec.ingredients?.map((ing: any, iIdx: number) => (
                        <div
                          key={iIdx}
                          className="flex justify-between text-neutral-300 py-0.5 border-b border-neutral-850"
                        >
                          <span>
                            {ing.ingredientName} ({Number(ing.quantity).toFixed(2)} {ing.unit})
                          </span>
                          <span className="font-mono text-neutral-400">GH₵{ing.totalCost}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {rec.prepInstructions && (
                    <div className="p-2 bg-neutral-850/60 rounded-lg text-[11px] text-neutral-400 italic">
                      &quot;{rec.prepInstructions}&quot;
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-neutral-800 flex justify-between items-center text-xs">
                  <span className="text-[10px] text-neutral-500">Auto-deducts on order</span>
                  <button
                    onClick={() => {
                      setSelectedMenuItemId(rec.menuItemId);
                      setYieldCount(rec.yieldCount);
                      setPrepInstructions(rec.prepInstructions || "");
                      setRecipeIngRows(
                        rec.ingredients?.map((i: any) => ({
                          ingredientId: i.ingredientId,
                          quantity: String(i.quantity),
                          unit: i.unit,
                        })) || []
                      );
                      setShowAddModal(true);
                    }}
                    className="text-amber-400 hover:text-amber-300 font-semibold"
                  >
                    Edit Recipe
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MODAL: New / Edit Recipe */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <form
            onSubmit={handleSaveRecipe}
            className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 w-full max-w-xl shadow-2xl space-y-4 max-h-[90vh] flex flex-col"
          >
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-white">Formulate Dish Recipe</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-neutral-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-neutral-300 block mb-1">Select Menu Item</label>
                  <select
                    required
                    value={selectedMenuItemId}
                    onChange={(e) => setSelectedMenuItemId(Number(e.target.value))}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="">Choose menu item...</option>
                    {menuItems.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} (GH₵{Number(m.price).toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-neutral-300 block mb-1">Portion Yield</label>
                  <input
                    type="number"
                    min={1}
                    value={yieldCount}
                    onChange={(e) => setYieldCount(Number(e.target.value))}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              {/* Dynamic Ingredients Rows */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-neutral-300">
                    Ingredient Proportions
                  </label>
                  <button
                    type="button"
                    onClick={addIngRow}
                    className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Row</span>
                  </button>
                </div>

                {recipeIngRows.map((row, idx) => (
                  <div key={idx} className="flex gap-2 items-center text-xs">
                    <select
                      value={row.ingredientId}
                      onChange={(e) => updateIngRow(idx, "ingredientId", e.target.value)}
                      className="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-white"
                    >
                      <option value="">Select ingredient...</option>
                      {allIngredients.map((ing) => (
                        <option key={ing.id} value={ing.id}>
                          {ing.name} (GH₵{Number(ing.costPerUnit).toFixed(2)}/{ing.unit})
                        </option>
                      ))}
                    </select>

                    <input
                      type="number"
                      step="0.001"
                      placeholder="Qty"
                      value={row.quantity}
                      onChange={(e) => updateIngRow(idx, "quantity", e.target.value)}
                      className="w-20 bg-neutral-800 border border-neutral-700 rounded-lg px-2 py-1.5 text-white font-mono text-right"
                    />

                    <span className="w-12 text-neutral-400 text-center font-mono">
                      {row.unit || "pcs"}
                    </span>

                    <button
                      type="button"
                      onClick={() => removeIngRow(idx)}
                      className="p-1.5 text-neutral-500 hover:text-rose-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-300 block mb-1">
                  Preparation & Cooking Instructions
                </label>
                <textarea
                  rows={2}
                  value={prepInstructions}
                  onChange={(e) => setPrepInstructions(e.target.value)}
                  placeholder="e.g. Sear on grill at 500F for 4 min, rest for 2 min..."
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-neutral-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-xs text-neutral-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-semibold bg-amber-500 text-black rounded-xl shadow-xs"
              >
                Save Recipe
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
