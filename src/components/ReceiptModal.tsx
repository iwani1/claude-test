"use client";

import React from "react";
import { Printer, X, CheckCircle, Smartphone } from "lucide-react";

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any;
  restaurantInfo?: any;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  order,
  restaurantInfo,
}) => {
  if (!isOpen || !order) return null;

  const handlePrint = () => {
    window.print();
  };

  const subtotal = Number(order.subtotal || 0);
  const tax = Number(order.taxAmount || 0);
  const serviceCharge = Number(order.serviceCharge || 0);
  // Dine-in "eat in the room" charge, set by the server from settings.
  const roomCharge = Number(order.roomCharge || 0);
  const discount = Number(order.discountAmount || 0);
  const tip = Number(order.tipAmount || 0);
  const total = Number(order.totalAmount || 0);
  const paid = Number(order.paidAmount || total);
  const change = Math.max(0, paid - total);

  // Complimentary breakfast: nothing charged, but the food value is shown so
  // the guest sees what was provided free.
  const isComp = order.isComplimentary === true || String(order.paymentMethod || "").toUpperCase() === "COMPLIMENTARY";
  const compValue = Number(order.compValue || (isComp ? subtotal : 0));

  // Derive the VAT rate actually applied rather than hardcoding 15%, so the
  // receipt stays correct if the rate is changed in settings.
  const taxableBase = Math.max(0, subtotal - (isComp ? 0 : discount)) + (isComp ? 0 : roomCharge);
  const taxRate = taxableBase > 0 ? Number(((tax / taxableBase) * 100).toFixed(2)) : 0;

  const restName = restaurantInfo?.name || "LUSH VIEW HOTEL";
  const restAddress = restaurantInfo?.address || "";
  const restPhone = restaurantInfo?.phone || "";
  const restTaxNo = restaurantInfo?.taxNumber || "";
  const receiptHeader = restaurantInfo?.receiptHeader || restName;
  const receiptFooter = restaurantInfo?.receiptFooter || "Thank you for visiting Lush View Hotel";
  const currency = restaurantInfo?.currencySymbol || "GH₵";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white text-black w-full max-w-md rounded-xl shadow-2xl overflow-hidden flex flex-col my-auto">
        {/* Header Actions */}
        <div className="flex items-center justify-between px-4 py-3 bg-neutral-900 text-white print:hidden">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Printer className="w-4 h-4 text-emerald-400" />
            <span>Thermal Receipt Preview (80mm)</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-neutral-800 rounded-md text-neutral-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Receipt Body */}
        <div className="p-6 font-mono text-xs leading-relaxed bg-neutral-50 border-y border-neutral-200 print:border-none print:p-0 print:bg-white">
          <div className="text-center mb-4">
            <h2 className="text-base font-bold tracking-wider uppercase text-neutral-900 whitespace-pre-line">
              {receiptHeader}
            </h2>
            {restAddress && <p className="text-neutral-600 mt-0.5">{restAddress}</p>}
            {restPhone && <p className="text-neutral-600">Tel: {restPhone}</p>}
            {restTaxNo && <p className="text-neutral-500 text-[0.6875rem] mt-1">GRA TIN: {restTaxNo}</p>}
            <p className="text-[0.625rem] text-neutral-500 font-bold uppercase">
              {isComp ? "Complimentary — No Charge" : "Official VAT Invoice"}
            </p>
          </div>

          {/* Comp banner — unmistakable so nobody mistakes a free order for a
              missing payment. */}
          {isComp && (
            <div className="border-2 border-black text-center py-1 mb-2">
              <span className="text-[0.8125rem] font-black tracking-widest uppercase">
                *** Complimentary ***
              </span>
              {order.complimentaryReason && (
                <div className="text-[0.625rem] font-semibold uppercase">
                  {order.complimentaryReason}
                </div>
              )}
            </div>
          )}

          <div className="border-t border-dashed border-neutral-400 my-2" />

          <div className="flex justify-between text-neutral-700">
            <span>Order #: {order.orderNumber}</span>
            <span>{order.orderType === "room_service" ? "ROOM SERVICE" : order.orderType?.toUpperCase()}</span>
          </div>
          <div className="flex justify-between text-neutral-700">
            <span>Date: {new Date(order.createdAt || 0).toLocaleString()}</span>
            {order.tableId && <span>Table: #{order.tableNumber || order.tableId}</span>}
            {order.roomNumber && <span>Room: {order.roomNumber}</span>}
          </div>
          <div className="flex justify-between text-neutral-700">
            {(order.cashierName || order.userName) && <span>Cashier: {order.cashierName || order.userName}</span>}
            <span>Guest: {order.customerName || "Walk-in"}</span>
          </div>

          <div className="border-t border-dashed border-neutral-400 my-2" />

          {/* Items Header */}
          <div className="grid grid-cols-12 font-bold text-neutral-800 pb-1 border-b border-neutral-300 mb-2">
            <span className="col-span-6">DISH / ITEM</span>
            <span className="col-span-2 text-center">QTY</span>
            <span className="col-span-4 text-right">TOTAL</span>
          </div>

          {/* Items List */}
          <div className="space-y-1.5 mb-2">
            {order.items?.map((it: any, idx: number) => (
              <div key={idx} className="grid grid-cols-12 text-neutral-800">
                <div className="col-span-6">
                  <span className="font-medium">{it.itemName || it.name}</span>
                  {it.modifiers && it.modifiers.length > 0 && (
                    <div className="text-[0.625rem] text-neutral-500 pl-2">
                      {it.modifiers.map((m: any, mIdx: number) => (
                        <div key={mIdx}>+ {m.optionName || m.name}</div>
                      ))}
                    </div>
                  )}
                  {it.specialInstructions && (
                    <div className="text-[0.625rem] text-amber-700 italic pl-2">
                      * {it.specialInstructions}
                    </div>
                  )}
                </div>
                <div className="col-span-2 text-center font-semibold">{it.quantity || it.qty}</div>
                <div className="col-span-4 text-right font-semibold">
                  {currency}
                  {Number(it.totalPrice || Number(it.unitPrice || it.price) * (it.quantity || 1)).toFixed(2)}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-dashed border-neutral-400 my-2" />

          {/* Totals & Ghana Tax Breakdown */}
          <div className="space-y-1 text-neutral-700">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>{currency}{subtotal.toFixed(2)}</span>
            </div>
            {discount > 0 && !isComp && (
              <div className="flex justify-between text-emerald-700">
                <span>Discount {order.discountReason ? `(${order.discountReason})` : ""}:</span>
                <span>-{currency}{discount.toFixed(2)}</span>
              </div>
            )}

            {/* Dine-in room charge — printed as its own line for transparency */}
            {roomCharge > 0 && (
              <div className="flex justify-between">
                <span>Room Charge (eat-in):</span>
                <span>{currency}{roomCharge.toFixed(2)}</span>
              </div>
            )}

            <div className="flex justify-between text-neutral-600">
              <span>GRA VAT ({taxRate}%):</span>
              <span>{currency}{tax.toFixed(2)}</span>
            </div>
            {serviceCharge > 0 && (
              <div className="flex justify-between">
                <span>Service Charge:</span>
                <span>{currency}{serviceCharge.toFixed(2)}</span>
              </div>
            )}
            {tip > 0 && !isComp && (
              <div className="flex justify-between">
                <span>Tip:</span>
                <span>{currency}{tip.toFixed(2)}</span>
              </div>
            )}

            {isComp ? (
              <>
                <div className="border-t-2 border-neutral-900 pt-1 flex justify-between font-black text-sm text-neutral-900">
                  <span>COMPLIMENTARY:</span>
                  <span>{currency}0.00</span>
                </div>
                <div className="flex justify-between text-[0.625rem] text-neutral-500">
                  <span>Value provided free of charge:</span>
                  <span>{currency}{compValue.toFixed(2)}</span>
                </div>
              </>
            ) : (
              <div className="border-t border-neutral-900 pt-1 flex justify-between font-bold text-sm text-neutral-900">
                <span>TOTAL DUE:</span>
                <span>{currency}{total.toFixed(2)}</span>
              </div>
            )}
          </div>

          <div className="border-t border-dashed border-neutral-400 my-2" />

          {/* Payment breakdown */}
          <div className="space-y-1.5 text-neutral-700">
            <div className="flex justify-between font-semibold">
              <span>Tender Method:</span>
              <span className="text-neutral-900">
                {(() => {
                  const raw = String(order.paymentMethod || "PAID");
                  if (raw.toLowerCase() === "momo") return "Mobile Money (MoMo)";
                  if (raw.toLowerCase() === "cash") return "Cash (GH₵)";
                  if (raw.toLowerCase().includes("split")) return "Split (Cash + MoMo)";
                  return raw;
                })()}
              </span>
            </div>

            {/* Split Breakdown if order was paid with both Cash and MoMo */}
            {(order.splitDetails || (order.paymentMethod && String(order.paymentMethod).toLowerCase().includes("split"))) && (
              <div className="p-2 bg-neutral-100 rounded-md text-[0.6875rem] space-y-1 border border-neutral-200">
                <div className="flex justify-between text-neutral-800">
                  <span>• Cash Payment:</span>
                  <span className="font-mono font-bold">
                    {currency}{Number(order.splitDetails?.cashAmount || order.cashAmount || 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-neutral-800">
                  <span>• MoMo Payment:</span>
                  <span className="font-mono font-bold">
                    {currency}{Number(order.splitDetails?.momoAmount || order.momoAmount || 0).toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            {order.referenceNumber && (
              <div className="flex justify-between text-[0.6875rem] text-neutral-500">
                <span>Reference:</span>
                <span className="font-mono">{order.referenceNumber}</span>
              </div>
            )}

            {order.cashTendered && Number(order.cashTendered) > 0 && (
              <div className="flex justify-between text-[0.6875rem] text-neutral-600">
                <span>Cash Tendered:</span>
                <span className="font-mono">{currency}{Number(order.cashTendered).toFixed(2)}</span>
              </div>
            )}

            <div className="flex justify-between font-medium">
              <span>Total Settled:</span>
              <span className="font-mono font-bold">{currency}{paid.toFixed(2)}</span>
            </div>

            {change > 0 && (
              <div className="flex justify-between font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded">
                <span>Change Returned:</span>
                <span className="font-mono">{currency}{change.toFixed(2)}</span>
              </div>
            )}
          </div>

          <div className="border-t border-dashed border-neutral-400 my-3" />

          {/* Barcode & Ghanaian Welcome Footer */}
          <div className="text-center space-y-1 text-neutral-600 text-[0.6875rem]">
            <p className="font-bold whitespace-pre-line">{receiptFooter}</p>
            <div className="py-2 flex justify-center">
              <div className="bg-neutral-900 text-white font-mono text-[0.5625rem] px-3 py-1 tracking-widest rounded-xs">
                *{order.orderNumber}*
              </div>
            </div>
            <p className="text-[0.625rem] text-neutral-400">Powered by Lush View Hotel POS</p>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-4 bg-neutral-100 flex items-center justify-end gap-3 print:hidden border-t border-neutral-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-200 rounded-lg transition"
          >
            Close
          </button>
          <button
            onClick={handlePrint}
            className="px-5 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-2 shadow-xs transition"
          >
            <Printer className="w-4 h-4" />
            <span>Print Receipt</span>
          </button>
        </div>
      </div>
    </div>
  );
};
