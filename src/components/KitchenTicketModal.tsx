"use client";

import React, { useMemo } from "react";
import { Printer, X, ChefHat, Flame, Wine, Cake, Clock, Utensils } from "lucide-react";

interface KitchenTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Order header fields. Accepts either a DB order or a locally built draft. */
  order: any;
}

const STATION_META: Record<string, { label: string; icon: any; color: string }> = {
  kitchen: { label: "HOT KITCHEN", icon: ChefHat, color: "text-orange-400" },
  grill: { label: "CHARCOAL GRILL", icon: Flame, color: "text-red-400" },
  bar: { label: "BAR / BEVERAGES", icon: Wine, color: "text-sky-400" },
  dessert: { label: "DESSERT STATION", icon: Cake, color: "text-pink-400" },
};

/**
 * Printed kitchen docket (paper ticket).
 *
 * The kitchen has no terminal access, so this printed slip IS the interface
 * between front-of-house and the line. It intentionally omits prices and
 * totals - the kitchen only needs what to cook, how much, and any notes.
 * Text is deliberately large and high-contrast for legibility across a
 * busy pass, and each preparation station is split onto its own block so
 * multi-station tickets can be torn and routed separately.
 */
export const KitchenTicketModal: React.FC<KitchenTicketModalProps> = ({
  isOpen,
  onClose,
  order,
}) => {
  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const it of order?.items || []) {
      const station = it.station || "kitchen";
      if (!map[station]) map[station] = [];
      map[station].push({
        ...it,
        quantity: Number(it.quantity ?? it.qty ?? 0),
        name: it.itemName || it.name || "",
        specialInstructions: it.specialInstructions || it.notes || "",
      });
    }
    // Deterministic station order for consistent tearing/routing.
    const order2 = ["grill", "kitchen", "bar", "dessert"];
    return order2
      .filter((k) => map[k]?.length)
      .map((k) => ({ station: k, items: map[k] }))
      .concat(
        Object.keys(map)
          .filter((k) => !order2.includes(k))
          .map((k) => ({ station: k, items: map[k] }))
      );
  }, [order]);

  if (!isOpen || !order) return null;

  // Order-line items and stored kitchen-ticket items use slightly different
  // field names, so normalise both into one printable shape.
  const lines = (order.items || []).map((it: any) => ({
    quantity: Number(it.quantity ?? it.qty ?? 0),
    name: it.itemName || it.name || "",
    modifiers: it.modifiers || [],
    specialInstructions: it.specialInstructions || it.notes || "",
    station: it.station || "kitchen",
  }));

  const itemCount = lines.reduce((sum: number, it: any) => sum + it.quantity, 0);

  // Complimentary breakfast: still cooked and still plated, but free.
  const isComplimentary =
    order.isComplimentary === true ||
    String(order.paymentMethod || "").toUpperCase() === "COMPLIMENTARY";

  const orderTypeLabel =
    order.orderType === "dine_in"
      ? `DINE-IN${order.tableId ? ` - TABLE ${order.tableNumber || order.tableId}` : ""}`
      : order.orderType === "room_service"
      ? `ROOM SERVICE${order.roomNumber ? ` - ROOM ${order.roomNumber}` : ""}`
      : order.orderType === "takeaway"
      ? "TAKEAWAY"
      : "DELIVERY";

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white text-black w-full max-w-sm rounded-lg shadow-2xl overflow-hidden flex flex-col my-auto">
        {/* Action bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-neutral-900 text-white print:hidden">
          <div className="flex items-center gap-2 text-sm font-bold">
            <ChefHat className="w-4 h-4 text-orange-400" />
            <span>Kitchen Docket — Print &amp; Deliver</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-neutral-800 rounded-md text-neutral-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Instructions banner */}
        <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-200 text-[0.6875rem] text-amber-900 print:hidden">
          Hand this printed slip to the kitchen. The kitchen has no screen
          access — this paper ticket is the order.
        </div>

        {/* Printable docket body */}
        <div className="p-5 font-mono bg-white print:p-0">
          {/* Docket header */}
          <div className="text-center border-b-2 border-black pb-2">
            <div className="text-xl font-black tracking-widest">KITCHEN ORDER</div>
            <div className="text-sm font-bold mt-0.5">{orderTypeLabel}</div>
            {/* A complimentary order still has to be cooked, but the kitchen
                must know it is free so nobody queries the missing bill. */}
            {isComplimentary && (
              <div className="mt-1.5 border-2 border-black py-1">
                <div className="text-sm font-black tracking-widest uppercase">
                  *** Complimentary ***
                </div>
                {order.complimentaryReason && (
                  <div className="text-[0.6875rem] font-bold uppercase">
                    {order.complimentaryReason}
                  </div>
                )}
                <div className="text-[0.625rem] font-semibold">Cook as normal — no charge to guest</div>
              </div>
            )}
          </div>

          {/* Order meta */}
          <div className="py-2 border-b border-dashed border-black text-xs space-y-0.5">
            <div className="flex justify-between font-bold">
              <span>ORDER:</span>
              <span className="text-base">{order.orderNumber}</span>
            </div>
            <div className="flex justify-between">
              <span>TIME IN:</span>
              <span className="font-bold">
                {new Date(order.createdAt || 0).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <div className="flex justify-between">
              <span>ITEMS:</span>
              <span className="font-bold">{itemCount}</span>
            </div>
            {order.customerName && (
              <div className="flex justify-between">
                <span>GUEST:</span>
                <span>{order.customerName}</span>
              </div>
            )}
            {(order.userName || order.cashierName) && (
              <div className="flex justify-between">
                <span>SERVER:</span>
                <span className="font-bold">{order.userName || order.cashierName}</span>
              </div>
            )}
            {order.notes && (
              <div className="pt-1 text-[0.6875rem] font-bold uppercase">
                TICKET NOTE: {order.notes}
              </div>
            )}
          </div>

          {/* Per-station blocks */}
          {grouped.map(({ station, items }) => {
            const meta = STATION_META[station] || {
              label: station.toUpperCase(),
              icon: Utensils,
              color: "text-neutral-700",
            };
            const StationIcon = meta.icon;

            return (
              <div key={station} className="pt-3">
                <div className="bg-black text-white px-2 py-1 text-sm font-black tracking-wider flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <StationIcon className="w-4 h-4" />
                    {meta.label}
                  </span>
                  <span>{items.length} line{items.length > 1 ? "s" : ""}</span>
                </div>

                <div className="divide-y divide-dashed divide-neutral-400">
                  {items.map((it: any, idx: number) => (
                    <div key={idx} className="py-2">
                      <div className="flex items-start gap-2">
                        <span className="text-2xl font-black leading-none min-w-[2rem]">
                          {it.quantity}x
                        </span>
                        <span className="text-sm font-bold uppercase leading-snug flex-1">
                          {it.name}
                        </span>
                      </div>

                      {/* Modifiers */}
                      {it.modifiers && it.modifiers.length > 0 && (
                        <div className="pl-10 mt-1 space-y-0.5">
                          {it.modifiers.map((m: any, mIdx: number) => (
                            <div key={mIdx} className="text-xs font-bold uppercase">
                              &raquo; {m.optionName || m.name}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Special instructions - highlighted */}
                      {it.specialInstructions && (
                        <div className="ml-10 mt-1 border-2 border-black px-1.5 py-1 text-xs font-black uppercase">
                          !! {it.specialInstructions}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Footer */}
          <div className="mt-3 pt-2 border-t-2 border-black text-center text-[0.6875rem] space-y-0.5">
            <div className="font-bold uppercase">--- End of Order ---</div>
            <div>Started cooking: ____________</div>
            <div>Completed &amp; plated: ____________</div>
            <div className="pt-1 text-[0.625rem]">
              Printed {new Date().toLocaleTimeString()} • Lush View Hotel
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 bg-neutral-100 flex items-center justify-end gap-3 print:hidden border-t border-neutral-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-200 rounded-lg transition"
          >
            Close
          </button>
          <button
            onClick={() => window.print()}
            className="px-5 py-2 text-sm font-bold bg-orange-600 hover:bg-orange-700 text-white rounded-lg flex items-center gap-2 shadow-xs transition"
          >
            <Printer className="w-4 h-4" />
            <span>Print Kitchen Docket</span>
          </button>
        </div>
      </div>
    </div>
  );
};
