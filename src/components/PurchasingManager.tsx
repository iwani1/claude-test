"use client";

import React, { useState, useEffect } from "react";
import {
  Truck,
  Plus,
  PackageCheck,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  X,
  FileText,
  Mail,
  Phone,
} from "lucide-react";

export const PurchasingManager: React.FC = () => {
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"orders" | "suppliers">("orders");

  // Modals
  const [showNewPoModal, setShowNewPoModal] = useState(false);
  const [showGrnModal, setShowGrnModal] = useState<any | null>(null);
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);

  // New PO Form
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | "">("");
  const [poNotes, setPoNotes] = useState("");
  const [poItems, setPoItems] = useState<{ ingredientId: number | ""; quantity: string; unitPrice: string; unit: string }[]>([
    { ingredientId: "", quantity: "10", unitPrice: "5.00", unit: "kg" },
  ]);

  // GRN items
  const [grnReceivedMap, setGrnReceivedMap] = useState<Record<number, string>>({});
  const [grnInvoiceNo, setGrnInvoiceNo] = useState("");

  // New Supplier Form
  const [supName, setSupName] = useState("");
  const [supContact, setSupContact] = useState("");
  const [supEmail, setSupEmail] = useState("");
  const [supPhone, setSupPhone] = useState("");
  const [supTerms, setSupTerms] = useState("Net 30");

  const fetchData = async () => {
    try {
      const [poRes, supRes, ingRes] = await Promise.all([
        fetch("/api/purchasing/orders"),
        fetch("/api/purchasing/suppliers"),
        fetch("/api/inventory"),
      ]);
      const [poData, supData, ingData] = await Promise.all([
        poRes.json(),
        supRes.json(),
        ingRes.json(),
      ]);

      if (poData.purchaseOrders) setPurchaseOrders(poData.purchaseOrders);
      if (supData.suppliers) setSuppliers(supData.suppliers);
      if (ingData.ingredients) setIngredients(ingData.ingredients);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const addPoItemRow = () => {
    setPoItems([...poItems, { ingredientId: "", quantity: "10", unitPrice: "5.00", unit: "pcs" }]);
  };

  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierId) return;

    const validItems = poItems.filter((it) => it.ingredientId && Number(it.quantity) > 0);
    if (validItems.length === 0) return;

    try {
      const res = await fetch("/api/purchasing/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: Number(selectedSupplierId),
          items: validItems.map((it) => ({
            ingredientId: it.ingredientId,
            orderedQuantity: it.quantity,
            unitPrice: it.unitPrice,
            unit: it.unit,
          })),
          notes: poNotes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowNewPoModal(false);
        setPoItems([{ ingredientId: "", quantity: "10", unitPrice: "5.00", unit: "kg" }]);
        setPoNotes("");
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleProcessGRN = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showGrnModal) return;

    const receivedPayload = showGrnModal.items.map((it: any) => ({
      poItemId: it.id,
      ingredientId: it.ingredientId,
      orderedQuantity: it.orderedQuantity,
      receivedQuantity: grnReceivedMap[it.id] !== undefined ? grnReceivedMap[it.id] : it.orderedQuantity,
      unitPrice: it.unitPrice,
    }));

    try {
      const res = await fetch("/api/purchasing/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchaseOrderId: showGrnModal.id,
          action: "receive_goods",
          invoiceNumber: grnInvoiceNo,
          receivedItems: receivedPayload,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`Goods received under GRN #${data.grnNumber}. Inventory quantities stocked automatically!`);
        setShowGrnModal(null);
        setGrnInvoiceNo("");
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/purchasing/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: supName,
          contactPerson: supContact,
          email: supEmail,
          phone: supPhone,
          paymentTerms: supTerms,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowAddSupplierModal(false);
        setSupName("");
        setSupContact("");
        setSupEmail("");
        setSupPhone("");
        fetchData();
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
            <Truck className="w-5 h-5 text-amber-500" />
            <span>Procurement & Supplier Management</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Purchase orders, receiving dock verification, and automatic stock receiving (GRN)
          </p>
        </div>

        <div className="flex gap-2">
          {activeTab === "orders" ? (
            <button
              onClick={() => setShowNewPoModal(true)}
              className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl flex items-center gap-1.5 text-xs shadow-md shadow-amber-500/20 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Create Purchase Order</span>
            </button>
          ) : (
            <button
              onClick={() => setShowAddSupplierModal(true)}
              className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl flex items-center gap-1.5 text-xs shadow-md shadow-amber-500/20 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Add Supplier</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 py-2.5 bg-neutral-900/60 border-b border-neutral-800 flex gap-2">
        <button
          onClick={() => setActiveTab("orders")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
            activeTab === "orders"
              ? "bg-amber-500 text-black"
              : "bg-neutral-800 text-neutral-300 hover:bg-neutral-750"
          }`}
        >
          Purchase Orders ({purchaseOrders.length})
        </button>
        <button
          onClick={() => setActiveTab("suppliers")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
            activeTab === "suppliers"
              ? "bg-amber-500 text-black"
              : "bg-neutral-800 text-neutral-300 hover:bg-neutral-750"
          }`}
        >
          Vendors & Suppliers ({suppliers.length})
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {activeTab === "orders" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {purchaseOrders.map((po) => {
                const isReceived = po.status === "received";

                return (
                  <div
                    key={po.id}
                    className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 shadow-xl flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="font-mono font-bold text-white text-sm">
                            {po.poNumber}
                          </span>
                          <h4 className="font-semibold text-neutral-300 text-xs mt-0.5">
                            {po.supplierName}
                          </h4>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                            isReceived
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                              : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                          }`}
                        >
                          {po.status}
                        </span>
                      </div>

                      <div className="text-[11px] text-neutral-400 mb-3">
                        Date: {new Date(po.createdAt).toLocaleDateString()}
                      </div>

                      {/* Items preview */}
                      <div className="p-2.5 bg-neutral-950 rounded-xl border border-neutral-850 space-y-1.5 text-xs mb-3">
                        <span className="text-[10px] uppercase font-bold text-neutral-500 block">
                          Ordered Items:
                        </span>
                        {po.items?.map((it: any, idx: number) => (
                          <div key={idx} className="flex justify-between text-neutral-300">
                            <span>
                              {it.ingredientName} ({Number(it.orderedQuantity).toFixed(1)} {it.unit})
                            </span>
                            <span className="font-mono text-neutral-400">GH₵{it.totalPrice}</span>
                          </div>
                        ))}
                      </div>

                      <div className="flex justify-between items-baseline font-bold text-sm text-white pt-1">
                        <span>Total PO Cost:</span>
                        <span className="font-mono text-amber-400">GH₵{po.total}</span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-neutral-800 flex justify-between items-center text-xs">
                      {isReceived ? (
                        <span className="text-emerald-400 flex items-center gap-1 font-semibold text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Goods In Stock</span>
                        </span>
                      ) : (
                        <button
                          onClick={() => {
                            setShowGrnModal(po);
                            setGrnReceivedMap({});
                          }}
                          className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition flex items-center justify-center gap-1.5"
                        >
                          <PackageCheck className="w-4 h-4" />
                          <span>Receive Goods (GRN)</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === "suppliers" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {suppliers.map((sup) => (
              <div
                key={sup.id}
                className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 shadow-xl space-y-3"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-white text-sm">{sup.name}</h4>
                    <p className="text-xs text-neutral-400 mt-0.5">{sup.contactPerson || "Rep"}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-neutral-800 text-[10px] font-mono text-neutral-300">
                    {sup.paymentTerms}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-neutral-300 pt-2 border-t border-neutral-800">
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-neutral-500" />
                    <span>{sup.email || "No email"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-neutral-500" />
                    <span>{sup.phone || "No phone"}</span>
                  </div>
                  <div className="text-[11px] text-neutral-400 mt-1">
                    Lead time: {sup.leadTimeDays || 2} days delivery
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL 1: Create PO */}
      {showNewPoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <form
            onSubmit={handleCreatePO}
            className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 w-full max-w-xl shadow-2xl space-y-4 max-h-[90vh] flex flex-col"
          >
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-white">Create Purchase Order</h3>
              <button
                type="button"
                onClick={() => setShowNewPoModal(false)}
                className="text-neutral-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
              <div>
                <label className="text-xs font-semibold text-neutral-300 block mb-1">
                  Select Supplier
                </label>
                <select
                  required
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(Number(e.target.value))}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value="">Choose vendor...</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.paymentTerms})
                    </option>
                  ))}
                </select>
              </div>

              {/* Items */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-neutral-300">Ordered Items</label>
                  <button
                    type="button"
                    onClick={addPoItemRow}
                    className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                {poItems.map((row, idx) => (
                  <div key={idx} className="flex gap-2 items-center text-xs">
                    <select
                      value={row.ingredientId}
                      onChange={(e) => {
                        const updated = [...poItems];
                        updated[idx].ingredientId = Number(e.target.value);
                        const ing = ingredients.find((i) => i.id === Number(e.target.value));
                        if (ing) {
                          updated[idx].unit = ing.unit;
                          updated[idx].unitPrice = ing.costPerUnit;
                        }
                        setPoItems(updated);
                      }}
                      className="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-white"
                    >
                      <option value="">Choose ingredient...</option>
                      {ingredients.map((ing) => (
                        <option key={ing.id} value={ing.id}>
                          {ing.name} (Stock: {Number(ing.currentStock).toFixed(1)} {ing.unit})
                        </option>
                      ))}
                    </select>

                    <input
                      type="number"
                      step="0.1"
                      placeholder="Qty"
                      value={row.quantity}
                      onChange={(e) => {
                        const updated = [...poItems];
                        updated[idx].quantity = e.target.value;
                        setPoItems(updated);
                      }}
                      className="w-20 bg-neutral-800 border border-neutral-700 rounded-lg px-2 py-1.5 text-white font-mono text-right"
                    />

                    <input
                      type="number"
                      step="0.01"
                      placeholder="Price"
                      value={row.unitPrice}
                      onChange={(e) => {
                        const updated = [...poItems];
                        updated[idx].unitPrice = e.target.value;
                        setPoItems(updated);
                      }}
                      className="w-20 bg-neutral-800 border border-neutral-700 rounded-lg px-2 py-1.5 text-white font-mono text-right"
                    />

                    <span className="w-10 text-neutral-400 text-center font-mono text-[11px]">
                      {row.unit}
                    </span>
                  </div>
                ))}
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-300 block mb-1">
                  Delivery Notes
                </label>
                <textarea
                  rows={2}
                  value={poNotes}
                  onChange={(e) => setPoNotes(e.target.value)}
                  placeholder="e.g. Deliver before 11:00 AM via loading dock #2..."
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl p-2.5 text-xs text-white"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-neutral-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewPoModal(false)}
                className="px-4 py-2 text-xs text-neutral-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-semibold bg-amber-500 text-black rounded-xl shadow-xs"
              >
                Submit Purchase Order
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 2: Goods Received Note (GRN) */}
      {showGrnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <form
            onSubmit={handleProcessGRN}
            className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4"
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <PackageCheck className="w-5 h-5 text-emerald-400" />
                  <span>Receive Goods ({showGrnModal.poNumber})</span>
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Confirm delivered quantities to automatically stock into active inventory
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowGrnModal(null)}
                className="text-neutral-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-neutral-300 block mb-1">Supplier Invoice Number</label>
                <input
                  type="text"
                  placeholder="e.g. INV-904128"
                  value={grnInvoiceNo}
                  onChange={(e) => setGrnInvoiceNo(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div className="space-y-2 pt-1">
                <span className="font-semibold text-neutral-200 block">Verify Quantities:</span>
                {showGrnModal.items?.map((it: any) => (
                  <div
                    key={it.id}
                    className="p-3 bg-neutral-850 rounded-xl border border-neutral-800 flex items-center justify-between"
                  >
                    <div>
                      <span className="font-bold text-white">{it.ingredientName}</span>
                      <div className="text-[11px] text-neutral-400">
                        Ordered: {Number(it.orderedQuantity).toFixed(1)} {it.unit} @ GH₵{it.unitPrice}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-neutral-500">Recv:</span>
                      <input
                        type="number"
                        step="0.1"
                        defaultValue={it.orderedQuantity}
                        onChange={(e) =>
                          setGrnReceivedMap({
                            ...grnReceivedMap,
                            [it.id]: e.target.value,
                          })
                        }
                        className="w-20 text-right bg-neutral-800 border border-neutral-700 rounded-lg px-2 py-1 text-xs text-white font-mono font-bold"
                      />
                      <span className="text-neutral-400 font-mono text-[11px]">{it.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-neutral-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowGrnModal(null)}
                className="px-4 py-2 text-xs text-neutral-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-xs"
              >
                Confirm & Stock Inventory
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 3: Add Supplier */}
      {showAddSupplierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <form
            onSubmit={handleAddSupplier}
            className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4"
          >
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-white">Add New Supplier</h3>
              <button
                type="button"
                onClick={() => setShowAddSupplierModal(false)}
                className="text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-neutral-300 block mb-1">Company / Vendor Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Austin Artisan Dairy"
                  value={supName}
                  onChange={(e) => setSupName(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="text-neutral-300 block mb-1">Contact Representative</label>
                <input
                  type="text"
                  placeholder="e.g. David Miller"
                  value={supContact}
                  onChange={(e) => setSupContact(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="text-neutral-300 block mb-1">Email</label>
                <input
                  type="email"
                  placeholder="orders@austindairy.com"
                  value={supEmail}
                  onChange={(e) => setSupEmail(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="text-neutral-300 block mb-1">Phone</label>
                <input
                  type="text"
                  placeholder="+1 (512) 555-0199"
                  value={supPhone}
                  onChange={(e) => setSupPhone(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setShowAddSupplierModal(false)}
                className="px-3 py-1.5 text-xs text-neutral-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-semibold bg-amber-500 text-black rounded-lg"
              >
                Save Supplier
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
