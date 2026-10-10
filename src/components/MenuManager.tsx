"use client";
import Image from "next/image";

import React, { useState } from "react";
import {
  UtensilsCrossed,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  ChefHat,
  Coffee,
  X,
  Edit2,
  Trash2,
} from "lucide-react";

interface MenuManagerProps {
  categories: any[];
  menuItems: any[];
  onRefresh: () => void;
}

export const MenuManager: React.FC<MenuManagerProps> = ({
  categories,
  menuItems,
  onRefresh,
}) => {
  const [selectedCatId, setSelectedCatId] = useState<number | "all">("all");
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sku, setSku] = useState("");
  const [price, setPrice] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [categoryId, setCategoryId] = useState<number>(categories[0]?.id || 1);
  const [station, setStation] = useState("kitchen");
  const [imageUrl, setImageUrl] = useState("");

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = editingItem
        ? await fetch(`/api/menu/${editingItem.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name,
              description,
              price,
              costPrice,
              station,
              imageUrl,
            }),
          })
        : await fetch("/api/menu", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name,
              description,
              sku,
              price,
              costPrice,
              categoryId,
              station,
              imageUrl,
            }),
          });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        alert(data.error || "Menu item was not saved");
        return;
      }

      setShowAddModal(false);
      setEditingItem(null);
      setName("");
      setDescription("");
      setPrice("");
      setCostPrice("");
      onRefresh();
    } catch (e) {
      console.error(e);
      alert("Could not reach the server. Menu item was not saved.");
    }
  };

  const handleToggleAvailable = async (item: any) => {
    try {
      const res = await fetch(`/api/menu/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAvailable: !item.isAvailable }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        alert(data.error || "Availability was not changed");
        return;
      }
      onRefresh();
    } catch (e) {
      console.error(e);
      alert("Could not reach the server. Availability was not changed.");
    }
  };

  const filtered = menuItems.filter((m) => {
    const matchCat = selectedCatId === "all" || m.categoryId === selectedCatId;
    const matchSearch =
      !search ||
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.sku?.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-neutral-950 overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-neutral-900 border-b border-neutral-800 flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <UtensilsCrossed className="w-5 h-5 text-amber-500" />
            <span>Menu Catalog & Dish Offerings</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Manage restaurant food items, stations, modifier links, and 86&apos;d availability
          </p>
        </div>

        <button
          onClick={() => {
            setEditingItem(null);
            setName("");
            setDescription("");
            setPrice("");
            setCostPrice("");
            setShowAddModal(true);
          }}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl text-xs shadow-md shadow-amber-500/20 flex items-center gap-1.5 transition"
        >
          <Plus className="w-4 h-4" />
          <span>New Menu Item</span>
        </button>
      </div>

      {/* Filter bar */}
      <div className="px-4 py-2.5 bg-neutral-900/60 border-b border-neutral-800 flex flex-col sm:flex-row gap-2 justify-between">
        <div className="flex gap-1.5 overflow-x-auto custom-scrollbar">
          <button
            onClick={() => setSelectedCatId("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
              selectedCatId === "all" ? "bg-amber-500 text-black" : "bg-neutral-800 text-neutral-300"
            }`}
          >
            All Categories ({menuItems.length})
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCatId(c.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                selectedCatId === c.id ? "bg-amber-500 text-black" : "bg-neutral-800 text-neutral-300"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-3 py-1 bg-neutral-800 border border-neutral-700 rounded-lg text-xs text-white focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* Items Table */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-850 text-neutral-400 uppercase text-[10px] tracking-wider border-b border-neutral-800">
              <tr>
                <th className="px-4 py-3">Photo & Dish</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Station</th>
                <th className="px-4 py-3 text-right">Selling Price</th>
                <th className="px-4 py-3 text-right">Cost Price</th>
                <th className="px-4 py-3 text-right">Recipe</th>
                <th className="px-4 py-3 text-center">Availability</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60 text-neutral-200">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-neutral-850/50">
                  <td className="px-4 py-2.5 flex items-center gap-3">
                    <Image unoptimized width={40} height={40}
                      src={item.imageUrl || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100"}
                      alt={item.name}
                      className="w-10 h-10 rounded-lg object-cover bg-neutral-800 shrink-0"
                    />
                    <div>
                      <div className="font-semibold text-white">{item.name}</div>
                      <div className="text-[10px] text-neutral-400 truncate max-w-xs">
                        {item.description}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-neutral-400">{item.sku}</td>
                  <td className="px-4 py-2.5 capitalize text-neutral-300">{item.station}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-bold text-white">
                    GH₵{Number(item.price).toFixed(2)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-neutral-400">
                    GH₵{Number(item.costPrice || 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {item.hasRecipe ? (
                      <span className="text-emerald-400 font-semibold text-[11px]">Linked</span>
                    ) : (
                      <span className="text-neutral-500 text-[11px]">Direct</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <button
                      onClick={() => handleToggleAvailable(item)}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        item.isAvailable
                          ? "bg-emerald-500/20 text-emerald-300"
                          : "bg-rose-500/20 text-rose-300"
                      }`}
                    >
                      {item.isAvailable ? "In Stock" : "86&apos;d Out"}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => {
                        setEditingItem(item);
                        setName(item.name);
                        setDescription(item.description || "");
                        setPrice(item.price);
                        setCostPrice(item.costPrice || "0.00");
                        setStation(item.station || "kitchen");
                        setImageUrl(item.imageUrl || "");
                        setShowAddModal(true);
                      }}
                      className="text-amber-400 hover:text-amber-300 font-semibold text-xs"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Add / Edit Item */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <form
            onSubmit={handleSaveItem}
            className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4"
          >
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-white">
                {editingItem ? "Edit Menu Item" : "Create New Menu Item"}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-neutral-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-neutral-300 block mb-1">Item Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Truffle Wild Mushroom Risotto"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              {!editingItem && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-neutral-300 block mb-1">Category</label>
                    <select
                      value={categoryId}
                      onChange={(e) => setCategoryId(Number(e.target.value))}
                      className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-neutral-300 block mb-1">SKU</label>
                    <input
                      type="text"
                      placeholder="ENT-001"
                      value={sku}
                      onChange={(e) => setSku(e.target.value)}
                      className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white font-mono"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-neutral-300 block mb-1">Selling Price (GH₵)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="75.00"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="text-neutral-300 block mb-1">Cost Price (GH₵)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="5.20"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-neutral-300 block mb-1">Kitchen Station</label>
                  <select
                    value={station}
                    onChange={(e) => setStation(e.target.value)}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="kitchen">Kitchen</option>
                    <option value="grill">Grill</option>
                    <option value="bar">Bar</option>
                    <option value="dessert">Dessert</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-neutral-300 block mb-1">Photo Image URL</label>
                <input
                  type="text"
                  placeholder="https://images.unsplash.com/..."
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="text-neutral-300 block mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Ingredients and tasting notes..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl p-2 text-white"
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
                Save Item
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
