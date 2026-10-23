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
import { notify } from "@/lib/notify";
import { MagneticDropZone } from "@/components/interface-studies";
import { ConfirmDialog } from "@/components/ConfirmDialog";

/**
 * Reads a dropped/chosen photo and shrinks it to a modest JPEG data URL so
 * it can be saved with the menu item like any other image address. Large
 * phone photos are downscaled (max 900px) — menu thumbnails never need more.
 */
function fileToMenuPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      const scale = Math.min(1, 900 / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      URL.revokeObjectURL(url);
      if (!ctx) {
        reject(new Error("no-canvas"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("unreadable-image"));
    };
    img.src = url;
  });
}

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

  // Delete (archive) + restore
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [archivedItems, setArchivedItems] = useState<any[]>([]);

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
        notify(data.error || "Menu item was not saved", "error");
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
      notify("Could not reach the server. Menu item was not saved.", "error");
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
        notify(data.error || "Availability was not changed", "error");
        return;
      }
      onRefresh();
    } catch (e) {
      console.error(e);
      notify("Could not reach the server. Availability was not changed.", "error");
    }
  };

  const fetchArchived = async () => {
    try {
      const res = await fetch("/api/menu?includeArchived=1");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify(data.error || "Deleted items could not be loaded", "error");
        return;
      }
      setArchivedItems((data.items || []).filter((i: any) => i.isArchived));
    } catch (e) {
      console.error(e);
      notify("Could not reach the server. Deleted items were not loaded.", "error");
    }
  };

  const handleDeleteItem = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    setDeleteError("");
    try {
      // The API requires a JSON content type on every write (else 415).
      const res = await fetch(`/api/menu/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setDeleteError(data.error || "Item was not removed");
        return;
      }
      notify(`"${deleteTarget.name}" removed from the menu.`, "ok");
      setDeleteTarget(null);
      onRefresh();
      if (showArchived) void fetchArchived();
    } catch (e) {
      console.error(e);
      setDeleteError("Could not reach the server. Item was not removed.");
    } finally {
      setDeleteBusy(false);
    }
  };

  const handleRestoreItem = async (item: any) => {
    try {
      const res = await fetch(`/api/menu/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        // Back on the list, still 86'd: staff choose when it sells again.
        body: JSON.stringify({ isArchived: false, isAvailable: false }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        notify(data.error || "Item was not restored", "error");
        return;
      }
      notify(`"${item.name}" is back on the menu list (still 86'd).`, "ok");
      void fetchArchived();
      onRefresh();
    } catch (e) {
      console.error(e);
      notify("Could not reach the server. Item was not restored.", "error");
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

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const next = !showArchived;
              setShowArchived(next);
              if (next) void fetchArchived();
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 ${
              showArchived ? "bg-rose-500 text-white" : "bg-neutral-800 text-neutral-300 hover:text-white"
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{showArchived ? "Back to menu" : "Deleted items"}</span>
          </button>
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
      </div>

      {/* Deleted (archived) items — restorable, history untouched */}
      {showArchived ? (
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="px-4 py-3 border-b border-neutral-800">
              <h3 className="text-sm font-bold text-white">Deleted items</h3>
              <p className="text-[0.6875rem] text-neutral-500 mt-0.5">
                These dishes are off the menu and the till, but their past sales stay in reports.
                Restore brings a dish back to the list, still 86&apos;d — tap In Stock when it should sell again.
              </p>
            </div>
            {archivedItems.filter(
              (i) => !search || i.name.toLowerCase().includes(search.toLowerCase()),
            ).length === 0 ? (
              <div className="p-8 text-center text-neutral-500 text-sm">No deleted items.</div>
            ) : (
              <div className="divide-y divide-neutral-800/60">
                {archivedItems
                  .filter((i) => !search || i.name.toLowerCase().includes(search.toLowerCase()))
                  .map((item) => (
                    <div key={item.id} className="px-4 py-3 flex items-center gap-3">
                      <Image
                        unoptimized
                        width={40}
                        height={40}
                        src={item.imageUrl || "/menu-images/placeholder.svg"}
                        alt={item.name}
                        className="w-10 h-10 rounded-lg object-cover bg-neutral-800 shrink-0 grayscale"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-white text-xs truncate">{item.name}</div>
                        <div className="text-[0.625rem] text-neutral-500 font-mono">
                          {item.sku} · GH₵{Number(item.price).toFixed(2)}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRestoreItem(item)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold transition active:scale-[0.98]"
                      >
                        Restore
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      ) : (
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-xl">
          {/* Phones: dish cards with full-size availability and edit buttons.
              This table has no horizontal scroll, so without them it clipped. */}
          <div className="md:hidden divide-y divide-neutral-800/70">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-neutral-500 text-sm">No menu items match this search.</div>
            ) : (
              filtered.map((item) => (
                <div key={item.id} className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <Image
                      unoptimized
                      width={56}
                      height={56}
                      src={item.imageUrl || "/menu-images/placeholder.svg"}
                      alt={item.name}
                      className="w-14 h-14 rounded-xl object-cover bg-neutral-800 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-white text-sm">{item.name}</div>
                      <div className="text-[0.6875rem] text-neutral-400 line-clamp-2">{item.description}</div>
                      <div className="text-[0.6875rem] text-neutral-500 font-mono mt-0.5">
                        {item.sku} · <span className="capitalize">{item.station}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono font-bold text-white">GH₵{Number(item.price).toFixed(2)}</div>
                      <div className="text-[0.6875rem] text-neutral-400 font-mono">
                        cost GH₵{Number(item.costPrice || 0).toFixed(2)}
                      </div>
                      <div className="text-[0.6875rem] font-semibold mt-0.5">
                        {item.hasRecipe ? (
                          <span className="text-emerald-400">Recipe linked</span>
                        ) : (
                          <span className="text-neutral-500">Direct</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleToggleAvailable(item)}
                      className={`flex-1 h-12 rounded-xl font-bold text-sm border transition active:scale-[0.98] ${
                        item.isAvailable
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                          : "bg-rose-500/20 text-rose-300 border-rose-500/40"
                      }`}
                    >
                      {item.isAvailable ? "In Stock — tap to 86" : "86'd Out — tap to restore"}
                    </button>
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
                      className="h-12 px-5 rounded-xl bg-neutral-800 border border-neutral-700 text-amber-400 font-bold text-sm transition active:scale-[0.98]"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        setDeleteError("");
                        setDeleteTarget(item);
                      }}
                      aria-label={`Remove ${item.name} from the menu`}
                      className="h-12 px-4 rounded-xl bg-neutral-800 border border-neutral-700 text-rose-400 font-bold text-sm transition active:scale-[0.98] flex items-center gap-1.5"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-850 text-neutral-400 uppercase text-[0.625rem] tracking-wider border-b border-neutral-800">
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
                      src={item.imageUrl || "/menu-images/placeholder.svg"}
                      alt={item.name}
                      className="w-10 h-10 rounded-lg object-cover bg-neutral-800 shrink-0"
                    />
                    <div>
                      <div className="font-semibold text-white">{item.name}</div>
                      <div className="text-[0.625rem] text-neutral-400 truncate max-w-xs">
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
                      <span className="text-emerald-400 font-semibold text-[0.6875rem]">Linked</span>
                    ) : (
                      <span className="text-neutral-500 text-[0.6875rem]">Direct</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <button
                      onClick={() => handleToggleAvailable(item)}
                      className={`px-2 py-0.5 rounded-md text-[0.625rem] font-bold ${
                        item.isAvailable
                          ? "bg-emerald-500/20 text-emerald-300"
                          : "bg-rose-500/20 text-rose-300"
                      }`}
                    >
                      {item.isAvailable ? "In Stock" : "86'd Out"}
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
                    <button
                      onClick={() => {
                        setDeleteError("");
                        setDeleteTarget(item);
                      }}
                      className="ml-3 text-rose-400 hover:text-rose-300 font-semibold text-xs inline-flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>
      )}

      {/* MODAL: Add / Edit Item */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto">
          <form
            onSubmit={handleSaveItem}
            className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4 max-h-[92dvh] overflow-y-auto my-auto"
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

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-neutral-300 block mb-1">Selling Price (GH₵)</label>
                  <input
                    type="number"
                        inputMode="decimal"
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
                        inputMode="decimal"
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
                <label className="text-neutral-300 block mb-1">Dish Photo</label>
                <MagneticDropZone
                  label="Drop a dish photo here"
                  hint="or tap to choose — it is resized and saved with the item"
                  invalidMessage="Please choose an image file (JPG, PNG or WebP)."
                  onFile={(file) => {
                    void fileToMenuPhoto(file)
                      .then((dataUrl) => {
                        setImageUrl(dataUrl);
                        notify("Photo attached — save the item to keep it.", "ok");
                      })
                      .catch(() => notify("That photo could not be read.", "error"));
                  }}
                />
                <input
                  type="text"
                  placeholder="…or paste an image address (optional)"
                  value={imageUrl.startsWith("data:") ? "" : imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="mt-2 w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white"
                />
                {imageUrl && (
                  <div className="mt-2 flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageUrl}
                      alt="Dish photo preview"
                      className="h-14 w-14 rounded-lg object-cover border border-neutral-700"
                    />
                    <button
                      type="button"
                      onClick={() => setImageUrl("")}
                      className="text-xs font-semibold text-rose-400 hover:text-rose-300"
                    >
                      Remove photo
                    </button>
                  </div>
                )}
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

      {/* CONFIRM: Remove item from the menu (archive — restorable) */}
      <ConfirmDialog
        open={!!deleteTarget}
        title={deleteTarget ? `Remove "${deleteTarget.name}" from the menu?` : "Remove item?"}
        message="It disappears from the till and this list straight away. Past sales and reports are not touched — a dish that has been sold stays in the history — and you can bring it back any time from Deleted items. For a dish that is only out of stock today, use the 86 button instead."
        confirmLabel="Remove from menu"
        cancelLabel="Keep it"
        busy={deleteBusy}
        busyLabel="Removing…"
        error={deleteError}
        onCancel={() => {
          setDeleteTarget(null);
          setDeleteError("");
        }}
        onConfirm={handleDeleteItem}
      />
    </div>
  );
};
