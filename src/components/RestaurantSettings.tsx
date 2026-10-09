"use client";

import React, { useState, useEffect } from "react";
import { Sliders, Save, CheckCircle2, Building, DollarSign, Smartphone } from "lucide-react";

export const RestaurantSettings: React.FC = () => {
  const [restaurant, setRestaurant] = useState<any>({
    name: "Asanka Royal Bistro & Lounge",
    phone: "+233 30 278 9011",
    email: "info@asankaroyal.com",
    address: "14 Senchi Street, Airport Residential Area, Accra, Ghana",
    taxNumber: "GRA-TIN-C002849102X",
    currency: "GHS",
    currencySymbol: "GH₵",
    defaultTaxRate: "15.00",
    defaultServiceCharge: "0.00",
    receiptHeader: "ASANKA ROYAL BISTRO & LOUNGE\nAuthentic Ghanaian Cuisine & Chop Bar Experience",
    receiptFooter: "Akwaaba! Medaase for dining with us.\nGRA VAT Invoice | MoMo: 055 892 4410",
  });
  const [momoNumber, setMomoNumber] = useState("0558924410");
  const [isSaved, setIsSaved] = useState(false);

  // Room-service charge — the fee added when hotel food is delivered to and
  // eaten in a guest room. Stored in application_settings (default GH₵30.00).
  const [roomCharge, setRoomCharge] = useState("30.00");
  const [compBreakfastEnabled, setCompBreakfastEnabled] = useState(true);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.restaurant) setRestaurant(data.restaurant);
        if (data.settings?.momo_merchant_number) setMomoNumber(data.settings.momo_merchant_number);
        const savedRoomCharge = data.settings?.room_service_charge ?? data.settings?.dine_in_room_charge;
        if (savedRoomCharge !== undefined) setRoomCharge(savedRoomCharge);
        if (data.settings?.complimentary_breakfast_enabled !== undefined) {
          setCompBreakfastEnabled(data.settings.complimentary_breakfast_enabled !== "false");
        }
      })
      .catch((e) => console.error(e));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantData: restaurant,
          settingsData: {
            momo_merchant_number: momoNumber,
            currency_symbol: restaurant.currencySymbol || "GH₵",
            currency_code: restaurant.currency || "GHS",
            tax_rate: restaurant.defaultTaxRate || "15.00",
            // The room-service charge and comp switch are read by the server
            // pricing engine on every order; no redeploy is needed to change them.
            room_service_charge: roomCharge,
            complimentary_breakfast_enabled: compBreakfastEnabled ? "true" : "false",
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 3000);
      }
    } catch {
      alert("Error saving settings");
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-neutral-950 overflow-hidden">
      <div className="p-4 bg-neutral-900 border-b border-neutral-800 flex justify-between items-center">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Sliders className="w-5 h-5 text-amber-500" />
            <span>Store Settings & Ghanaian Localization</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Configure currency (GH₵), Ghana Revenue Authority (GRA) tax rates, MoMo merchant lines, and receipt branding
          </p>
        </div>

        {isSaved && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4" />
            <span>Settings Saved!</span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <form onSubmit={handleSave} className="max-w-3xl space-y-5">
          {/* Business Details */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white">Restaurant Business Profile</h3>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="col-span-2 sm:col-span-1">
                <label className="text-neutral-300 block mb-1">Restaurant Display Name</label>
                <input
                  type="text"
                  value={restaurant.name || ""}
                  onChange={(e) => setRestaurant({ ...restaurant, name: e.target.value })}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="col-span-2 sm:col-span-1">
                <label className="text-neutral-300 block mb-1">Ghana GRA Taxpayer TIN</label>
                <input
                  type="text"
                  value={restaurant.taxNumber || ""}
                  onChange={(e) => setRestaurant({ ...restaurant, taxNumber: e.target.value })}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div className="col-span-2 sm:col-span-1">
                <label className="text-neutral-300 block mb-1">Official Phone Line</label>
                <input
                  type="text"
                  value={restaurant.phone || ""}
                  onChange={(e) => setRestaurant({ ...restaurant, phone: e.target.value })}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="col-span-2 sm:col-span-1">
                <label className="text-neutral-300 block mb-1">Business Email</label>
                <input
                  type="email"
                  value={restaurant.email || ""}
                  onChange={(e) => setRestaurant({ ...restaurant, email: e.target.value })}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="col-span-2">
                <label className="text-neutral-300 block mb-1">Location Address</label>
                <input
                  type="text"
                  value={restaurant.address || ""}
                  onChange={(e) => setRestaurant({ ...restaurant, address: e.target.value })}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white"
                />
              </div>
            </div>
          </div>

          {/* Tax & Financial Rules */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white">Financial & Ghana Revenue Authority (GRA) Tax Rules</h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="text-neutral-300 block mb-1">Currency Code</label>
                <input
                  type="text"
                  value={restaurant.currency || "GHS"}
                  onChange={(e) => setRestaurant({ ...restaurant, currency: e.target.value })}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="text-neutral-300 block mb-1">Currency Symbol</label>
                <input
                  type="text"
                  value={restaurant.currencySymbol || "GH₵"}
                  onChange={(e) => setRestaurant({ ...restaurant, currencySymbol: e.target.value })}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="text-neutral-300 block mb-1">GRA Standard VAT (%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={restaurant.defaultTaxRate || "15.00"}
                  onChange={(e) => setRestaurant({ ...restaurant, defaultTaxRate: e.target.value })}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="text-neutral-300 block mb-1">Service Charge (%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={restaurant.defaultServiceCharge || "0.00"}
                  onChange={(e) =>
                    setRestaurant({ ...restaurant, defaultServiceCharge: e.target.value })
                  }
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>
            </div>
          </div>

          {/* Eat-in Room Charge & Complimentary Breakfast */}
          <div className="bg-neutral-900 border border-sky-500/30 rounded-2xl p-5 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Building className="w-4 h-4 text-sky-400" />
              <span>Room-Service Charge &amp; Complimentary Breakfast</span>
            </h3>

            <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/25 text-[11.5px] text-sky-100">
              A flat charge is added only when food is delivered to and eaten in a hotel room.
              Restaurant table dining, takeaway and delivery are never charged it. VAT is applied
              on top. Change the amount here and it takes effect on the very next room-service order.
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-neutral-300 block mb-1 font-semibold">
                  Room-Service Charge (GH₵)
                </label>
                <input
                  type="number"
                  step="0.50"
                  min="0"
                  value={roomCharge}
                  onChange={(e) => setRoomCharge(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2.5 text-white font-mono font-bold text-base focus:outline-none focus:border-sky-500"
                />
                <p className="text-[10.5px] text-neutral-500 mt-1">
                  Currently GH₵{roomCharge || "0.00"} per room-service order. Set to 0.00 to disable.
                </p>
              </div>

              <div>
                <label className="text-neutral-300 block mb-1 font-semibold">
                  Quick amounts
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {["0", "20", "30", "50"].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setRoomCharge(`${amt}.00`)}
                      className={`h-10 rounded-xl border font-bold text-[12px] transition ${
                        Number(roomCharge) === Number(amt)
                          ? "bg-sky-500 border-sky-400 text-black"
                          : "bg-neutral-800 border-neutral-700 text-neutral-300 hover:bg-neutral-750"
                      }`}
                    >
                      {Number(amt) === 0 ? "Off" : `GH₵${amt}`}
                    </button>
                  ))}
                </div>
                <p className="text-[10.5px] text-neutral-500 mt-1.5">
                  Any value can be typed in the field above.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-neutral-800">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={compBreakfastEnabled}
                  onChange={(e) => setCompBreakfastEnabled(e.target.checked)}
                  className="mt-0.5 w-5 h-5 rounded accent-sky-500 shrink-0"
                />
                <span className="text-xs">
                  <span className="font-bold text-white block">
                    Allow complimentary breakfast orders
                  </span>
                  <span className="text-neutral-400">
                    Lets staff mark an order as free for a room guest. The bill totals GH₵0.00
                    with no VAT and no room charge, but stock is still deducted, the kitchen docket
                    still prints, and every comp is written to the audit log. Turn this off to
                    remove the button from the till entirely.
                  </span>
                </span>
              </label>
            </div>
          </div>

          {/* Ghana Mobile Money Integration Settings */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-amber-500" />
              <span>Mobile Money (MoMo) Merchant Configuration</span>
            </h3>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="col-span-2 sm:col-span-1">
                <label className="text-neutral-300 block mb-1">MTN / Telecel Merchant Number</label>
                <input
                  type="text"
                  value={momoNumber}
                  onChange={(e) => setMomoNumber(e.target.value)}
                  placeholder="055 892 4410"
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="text-neutral-300 block mb-1">Settlement Bank / GhIPSS Account</label>
                <input
                  type="text"
                  defaultValue="GCB Bank Ghana - Airport Branch"
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white"
                />
              </div>
            </div>
          </div>

          {/* Receipt Customization */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white">Thermal Receipt Customization</h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-neutral-300 block mb-1">Receipt Header Text</label>
                <textarea
                  rows={2}
                  value={restaurant.receiptHeader || ""}
                  onChange={(e) => setRestaurant({ ...restaurant, receiptHeader: e.target.value })}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl p-2.5 text-white font-mono text-xs"
                />
              </div>

              <div>
                <label className="text-neutral-300 block mb-1">Receipt Footer Note</label>
                <textarea
                  rows={2}
                  value={restaurant.receiptFooter || ""}
                  onChange={(e) => setRestaurant({ ...restaurant, receiptFooter: e.target.value })}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl p-2.5 text-white font-mono text-xs"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl text-xs shadow-md shadow-amber-500/20 flex items-center gap-2 transition"
          >
            <Save className="w-4 h-4" />
            <span>Save Settings</span>
          </button>
        </form>
      </div>
    </div>
  );
};
