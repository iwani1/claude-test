"use client";
import Image from "next/image";

import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  DollarSign,
  Percent,
  ChefHat,
  Receipt,
  User,
  Phone,
  CheckCircle2,
  Coffee,
  X,
  Smartphone,
  Printer,
  Coins,
  ShoppingCart,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { ReceiptModal } from "./ReceiptModal";
import { KitchenTicketModal } from "./KitchenTicketModal";
import { ConfirmDialog } from "./ConfirmDialog";
import { saveTicketDraft, readTicketDraft } from "@/lib/active-ticket";
import {
  queueOfflineOrder,
  saveBillingConfigToCache,
  getCachedBillingConfig,
} from "@/lib/offline-storage";
import { notify } from "@/lib/notify";
import { priceOrder, fromCents, toCents } from "@/lib/pricing-core";
import type { BillingConfig } from "@/lib/pricing-core";
import { apiErrorMessage, apiFetch } from "@/lib/api-client";
import type { CurrentUser } from "@/lib/api-types";

interface PosTerminalProps {
  categories: any[];
  menuItems: any[];
  tables: any[];
  currentUser: CurrentUser;
  onOrderCreated?: () => void;
  activeTableId?: number | null;
}

export const PosTerminal: React.FC<PosTerminalProps> = ({
  categories,
  menuItems,
  tables,
  currentUser,
  onOrderCreated,
  activeTableId = null,
}) => {
  // State
  const [selectedCategory, setSelectedCategory] = useState<number | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  /* The open ticket is restored from the staff member's draft: tapping
     Tables/Orders/Drawer (or a crash/restart) no longer destroys a
     half-taken order. */
  const [cart, setCart] = useState<any[]>(() => readTicketDraft(currentUser?.id ?? "anon"));
  /**
   * Phones and small tablets show the open order as a slide-up sheet — the
   * pattern chosen for this app — so the menu keeps the full screen and the
   * bar along the bottom carries the running total. md and up render the very
   * same panel in flow as the right-hand column, so only one copy of the cart
   * exists (no duplicated state, no second set of handlers).
   */
  const [cartOpen, setCartOpen] = useState(false);

  /**
   * One stable order identity per ticket.
   *
   * The server de-duplicates on this key, so a connection that dies between the
   * request and its answer can be retried safely: the replay returns the order
   * that already exists instead of creating a second one for the same food. It
   * is dropped whenever the ticket itself changes, because a changed ticket is
   * a different order.
   */
  const orderIdentityRef = useRef<string | null>(null);
  /**
   * One key per payment attempt.
   *
   * The server replays a repeated key instead of recording the money twice, so
   * a till that lost the answer can safely retry the *same* tender. Changing
   * what is being tendered (amount, method, cash handed over) starts a new
   * attempt with a new key, because that is a different payment.
   */
  const payAttemptRef = useRef<string | null>(null);
  const payAttemptKey = () => {
    if (!payAttemptRef.current) {
      payAttemptRef.current = `PAY-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }
    return payAttemptRef.current;
  };
  const orderIdentity = () => {
    if (!orderIdentityRef.current) {
      orderIdentityRef.current = `ORD-${Date.now()}-${Math.random()}`;
    }
    return orderIdentityRef.current;
  };
  useEffect(() => {
    orderIdentityRef.current = null;
  }, [cart]);



  /* Destructive taps (discard ticket, remove a line) ask first. Busy-bar
     fingers miss; the toast-light confirm costs half a second and saves the
     whole ticket. */
  const [pendingConfirm, setPendingConfirm] = useState<null | {
    title: string;
    message: string;
    confirmLabel: string;
    action: () => void;
  }>(null);

  /* Keep the draft in step with the cart; the global "New Order" buttons
     read it to warn before discarding a loaded ticket. */
  useEffect(() => {
    saveTicketDraft(currentUser?.id ?? "anon", cart);
  }, [cart, currentUser?.id]);
  const [orderType, setOrderType] = useState<"dine_in" | "room_service" | "takeaway" | "delivery">("dine_in");
  const [selectedTableId, setSelectedTableId] = useState<number | null>(activeTableId);
  const [roomNumber, setRoomNumber] = useState("");
  const [customerName, setCustomerName] = useState("Walk-in Guest");
  const [customerPhone, setCustomerPhone] = useState("");
  const [orderNotes, setOrderNotes] = useState("");

  // Modals
  const [selectedItemForMod, setSelectedItemForMod] = useState<any | null>(null);
  const [itemModSelections, setItemModSelections] = useState<Record<string, any>>({});
  const [itemSpecialNotes, setItemSpecialNotes] = useState("");

  // Discount & Tip
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [discountReason, setDiscountReason] = useState("");
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [tipAmount, setTipAmount] = useState<number>(0);

  // Payment: Staff indicates Cash, MoMo, or Split (Both)
  const [showPayModal, setShowPayModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"momo" | "cash" | "split">("momo");
  const [momoRef, setMomoRef] = useState<string>("");
  const [cashTendered, setCashTendered] = useState<string>("");
  const [splitCashAmount, setSplitCashAmount] = useState<string>("");
  const [splitMomoAmount, setSplitMomoAmount] = useState<string>("");

  // Changing what is being tendered starts a new payment attempt, so the retry
  // key of the previous attempt is dropped.
  useEffect(() => {
    payAttemptRef.current = null;
  }, [paymentMethod, cashTendered, splitCashAmount, splitMomoAmount, momoRef]);
  const [splitCashTendered, setSplitCashTendered] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Live billing rules (dine-in room charge + VAT) loaded from the server so
  // the total shown on the till matches what the API will actually charge.
  const [billingConfig, setBillingConfig] = useState<BillingConfig>({
    roomChargeCents: 3000, // GH₵30.00 default until the server responds
    taxRatePercent: 15,
    compBreakfastEnabled: true,
  });

  // Complimentary breakfast: a room guest eats free. Stock is still deducted
  // and the kitchen still gets a docket, but nothing is charged.
  const [isComplimentary, setIsComplimentary] = useState(false);
  const [compReason, setCompReason] = useState("Complimentary breakfast — room guest");
  const [showCompModal, setShowCompModal] = useState(false);

  // Adjust local table selection only when the parent selection changes.
  const [previousTableId, setPreviousTableId] = useState(activeTableId);
  if (previousTableId !== activeTableId) {
    setPreviousTableId(activeTableId);
    setSelectedTableId(activeTableId ?? null);
  }

  // Load the live room charge + VAT so the till never shows a stale amount
  // after management changes the charge in Settings. The last answer from the
  // server is kept on the device: with the signal gone, pricing continues on
  // the confirmed rate instead of silently reverting to a built-in guess.
  useEffect(() => {
    let cancelled = false;
    const branchId = currentUser?.branchId;
    (async () => {
      try {
        const data = await apiFetch("/api/billing-config");
        if (cancelled || !data) return;
        setBillingConfig({
          roomChargeCents: Number(data.roomChargeCents ?? 3000),
          taxRatePercent: Number(data.taxRatePercent ?? 15),
          compBreakfastEnabled: data.compBreakfastEnabled !== false,
        });
        if (branchId) saveBillingConfigToCache(data, branchId);
      } catch (e) {
        if (cancelled) return;
        const cached = branchId ? getCachedBillingConfig(branchId) : null;
        if (cached) {
          setBillingConfig({
            roomChargeCents: Number(cached.roomChargeCents ?? 3000),
            taxRatePercent: Number(cached.taxRatePercent ?? 15),
            compBreakfastEnabled: cached.compBreakfastEnabled !== false,
          });
          notify(apiErrorMessage(e, "Offline — using the room charge and VAT last confirmed by the server."), "warn");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.branchId]);

  // Post-payment receipt modal
  const [lastCompletedOrder, setLastCompletedOrder] = useState<any | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);

  // Kitchen docket printing. The kitchen has no terminal access, so every
  // order that goes to the line must be printed and physically delivered.
  const [kitchenTicketOrder, setKitchenTicketOrder] = useState<any | null>(null);
  const [showKitchenTicket, setShowKitchenTicket] = useState(false);
  /** Receipt deferred until the docket has been printed on paid orders. */
  const [pendingReceipt, setPendingReceipt] = useState<any | null>(null);

  // Filtered menu items
  const filteredItems = useMemo(() => {
    return menuItems.filter((item) => {
      const matchCat = selectedCategory === "all" || item.categoryId === selectedCategory;
      const matchSearch =
        !searchQuery ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.sku?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch && item.isAvailable;
    });
  }, [menuItems, selectedCategory, searchQuery]);

  // Click menu item -> open modifier modal if item has modifiers, or add directly to cart
  const handleItemClick = (item: any) => {
    if (item.modifiers && item.modifiers.length > 0) {
      setSelectedItemForMod(item);
      setItemModSelections({});
      setItemSpecialNotes("");
    } else {
      addItemToCart(item, [], "");
    }
  };

  const addItemToCart = (item: any, selectedMods: any[], specialNotes: string) => {
    let modPriceTotal = 0;
    selectedMods.forEach((m) => {
      modPriceTotal += Number(m.priceDelta || 0);
    });

    const unitPrice = Number(item.price) + modPriceTotal;

    // Check if identical item with identical modifiers exists
    const cartItemId = `${item.id}-${JSON.stringify(selectedMods)}-${specialNotes}`;
    const existingIndex = cart.findIndex((ci) => ci.cartItemId === cartItemId);

    if (existingIndex > -1) {
      const updated = [...cart];
      updated[existingIndex].quantity += 1;
      updated[existingIndex].totalPrice = (updated[existingIndex].quantity * unitPrice).toFixed(2);
      setCart(updated);
    } else {
      setCart([
        ...cart,
        {
          cartItemId,
          menuItemId: item.id,
          itemName: item.name,
          quantity: 1,
          basePrice: Number(item.price),
          unitPrice: unitPrice,
          totalPrice: unitPrice.toFixed(2),
          costPrice: item.costPrice || "0.00",
          modifiers: selectedMods,
          specialInstructions: specialNotes,
          station: item.station || "kitchen",
        },
      ]);
    }
  };

  const updateQuantity = (index: number, delta: number) => {
    const updated = [...cart];
    const newQty = updated[index].quantity + delta;
    if (newQty <= 0) {
      updated.splice(index, 1);
    } else {
      updated[index].quantity = newQty;
      updated[index].totalPrice = (newQty * updated[index].unitPrice).toFixed(2);
    }
    setCart(updated);
  };

  const removeCartItem = (index: number) => {
    const updated = [...cart];
    updated.splice(index, 1);
    setCart(updated);
  };

  const clearCart = () => {
    orderIdentityRef.current = null;
    setCart([]);
    setDiscountPercent(0);
    setDiscountAmount(0);
    setTipAmount(0);
  };

  const handleNewTicketLocal = () => {
    setCart([]);
    setDiscountPercent(0);
    setDiscountAmount(0);
    setDiscountReason("");
    setTipAmount(0);
    setOrderNotes("");
    setIsComplimentary(false);
    setCustomerName("Walk-in Guest");
    setCustomerPhone("");
    setRoomNumber("");
    setSelectedTableId(null);
    setOrderType("dine_in");
  };

  /** Both "New Ticket" and "Clear" route through here: an empty ticket resets
   *  instantly, a loaded one asks first. */
  const requestNewTicket = () => {
    if (cart.length === 0) {
      handleNewTicketLocal();
      return;
    }
    const total = cart.reduce((sum, it) => sum + Number(it.totalPrice || 0), 0);
    setPendingConfirm({
      title: "Discard this ticket?",
      message: `The ticket has ${cart.length} item${cart.length === 1 ? "" : "s"} (GH₵${total.toFixed(2)}). Those lines will be removed.`,
      confirmLabel: "Discard ticket",
      action: () => handleNewTicketLocal(),
    });
  };

  // ---------------------------------------------------------------------
  // Bill maths — the SAME function the server uses (pricing-core), so the
  // total displayed here is exactly the total that gets charged.
  // ---------------------------------------------------------------------
  const pricing = useMemo(
    () =>
      priceOrder({
        lines: cart.map((it) => ({
          unitPrice: it.unitPrice,
          quantity: it.quantity,
        })),
        orderType,
        discountCents: toCents(discountAmount),
        discountPercent,
        tipCents: toCents(tipAmount),
        isComplimentary,
        config: billingConfig,
      }),
    [cart, orderType, discountAmount, discountPercent, tipAmount, isComplimentary, billingConfig]
  );

  const subtotal = pricing.subtotalCents / 100;
  const calculatedDiscount = pricing.discountCents / 100;
  const taxAmount = pricing.taxCents / 100;
  const roomCharge = pricing.roomChargeCents / 100;
  const serviceCharge = 0;
  const totalAmount = pricing.totalCents / 100;
  const cartCount = cart.reduce((n, it) => n + it.quantity, 0);

  // Back closes the cart sheet, matching the drawer on tablet/phone widths.
  useEffect(() => {
    if (!cartOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCartOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cartOpen]);

  /** Builds the printable kitchen docket from whatever we know locally. */
  const buildKitchenTicket = (order: any, items: any[]) => {
    const table = tables.find((t) => t.id === (order.tableId ?? selectedTableId));
    return {
      ...order,
      tableNumber: table?.tableNumber,
      roomNumber: order.roomNumber || (orderType === "room_service" ? roomNumber : null),
      items,
    };
  };

  // Handle Save / Send to Kitchen
  const handleSendToKitchen = async () => {
    if (cart.length === 0) return;
    if (orderType === "room_service" && !roomNumber.trim()) {
      notify("Enter the hotel room number before sending a Room Service order.", "warn");
      return;
    }
    setIsSubmitting(true);

    // Totals here are a preview only; the server re-prices the bill from the
    // menu database and the live settings, so these fields are informational.
    const payload = {
      branchId: currentUser.branchId,
      tableId: orderType === "dine_in" ? selectedTableId : null,
      roomNumber: orderType === "room_service" ? roomNumber.trim() : null,
      userId: currentUser.id,
      customerName,
      customerPhone,
      orderType,
      discountAmount: calculatedDiscount.toFixed(2),
      discountReason,
      tipAmount: tipAmount.toFixed(2),
      notes: orderNotes,
      items: cart,
      sendToKitchen: true,
      isComplimentary,
      complimentaryReason: isComplimentary ? compReason : undefined,
      idempotencyKey: orderIdentity(),
    };

    try {
      if (!navigator.onLine) {
        // No signal: the order goes onto this device's queue.
        const stored = queueOfflineOrder({
          ...payload,
          clientTimestamp: Date.now(),
          paidAmount: 0,
          paymentMethod: "unpaid",
          paymentStatus: "unpaid",
          subtotal,
          taxAmount,
          serviceCharge,
          discountAmount: calculatedDiscount,
          tipAmount,
          totalAmount,
        });
        if (stored) {
          notify(
            "No connection. The order is saved on this device and goes to the kitchen as soon as the server is reachable — start the ticket on paper now so the line is not waiting.",
            "warn"
          );
          clearCart();
        } else {
          // Saying "saved" here would be a lie: the ticket is still the only
          // record of this sale, so it stays on screen.
          notify(
            "No connection, and this device could not store the order. The ticket is still on screen — write it down and send it again once there is signal.",
            "error"
          );
        }
        setIsSubmitting(false);
        return;
      }

      const data = await apiFetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (data.success) {
        clearCart();
        if (onOrderCreated) onOrderCreated();
        // The kitchen has no screen, so the printed docket IS the order.
        setKitchenTicketOrder(buildKitchenTicket(data.order, cart));
        setCartOpen(false);
        setShowKitchenTicket(true);
      } else {
        notify(data.error || "Failed to create order", "error");
      }
    } catch (e) {
      // The connection died somewhere between the tap and the answer. The order
      // identity travels with the payload, so queueing it here is safe even if
      // the server did receive it: the replay returns the existing order rather
      // than ringing the food twice.
      const stored = queueOfflineOrder({
        ...payload,
        clientTimestamp: Date.now(),
        paidAmount: 0,
        paymentMethod: "unpaid",
        paymentStatus: "unpaid",
        subtotal,
        taxAmount,
        serviceCharge,
        discountAmount: calculatedDiscount,
        tipAmount,
        totalAmount,
      });
      if (stored) {
        notify(apiErrorMessage(e, "Connection lost while sending. The order is saved on this device and syncs automatically — nothing was sent to the kitchen yet, so start the ticket on paper now."),
          "warn"
        );
        clearCart();
      } else {
        notify(
          "Connection lost, and this device could not store the order. The ticket is still on screen — write it down, then send it again when there is signal.",
          "error"
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Pay and Settle Bill (Cash, MoMo, or Split)
  const handleProcessPayment = async () => {
    if (cart.length === 0) return;
    if (orderType === "room_service" && !roomNumber.trim()) {
      notify("Enter the hotel room number before settling a Room Service order.", "warn");
      return;
    }
    setIsSubmitting(true);

    const payMethod = paymentMethod; // "cash" | "momo" | "split"
    const tenderedCashNum = cashTendered ? Number(cashTendered) : totalAmount;

    let payloadCashAmount: number | undefined = undefined;
    let payloadMomoAmount: number | undefined = undefined;
    let payloadCashTendered: string | null = null;
    let payloadReference: string = "CASH-REGISTER";

    if (payMethod === "cash") {
      payloadCashTendered = tenderedCashNum.toFixed(2);
      payloadReference = "CASH-REGISTER";
    } else if (payMethod === "momo") {
      payloadReference = momoRef.trim() || `MOMO-${Date.now().toString().slice(-6)}`;
    } else if (payMethod === "split") {
      const cPart = Number(splitCashAmount || 0);
      const mPart = Number(splitMomoAmount || 0);
      const cTendered = splitCashTendered ? Number(splitCashTendered) : cPart;
      payloadCashAmount = cPart;
      payloadMomoAmount = mPart;
      payloadCashTendered = cTendered.toFixed(2);
      payloadReference = momoRef.trim() || `MOMO-SPLIT-${Date.now().toString().slice(-6)}`;
    }

    // The server re-prices from the menu database + live settings; these
    // totals are a preview only and are deliberately not sent as authoritative.
    const orderPayload = {
      idempotencyKey: orderIdentity(),
      branchId: currentUser.branchId,
      tableId: orderType === "dine_in" ? selectedTableId : null,
      roomNumber: orderType === "room_service" ? roomNumber.trim() : null,
      userId: currentUser.id,
      customerName,
      customerPhone: customerPhone || null,
      orderType,
      discountAmount: calculatedDiscount.toFixed(2),
      discountReason,
      tipAmount: tipAmount.toFixed(2),
      notes: orderNotes,
      items: cart,
      sendToKitchen: true,
      isComplimentary,
      complimentaryReason: isComplimentary ? compReason : undefined,
    };

    /**
     * Closes out a bill that the server has confirmed as settled: docket to the
     * kitchen first, then the customer receipt. Used both by the normal path and
     * by the recovered path below, so a lost answer ends the same way as a
     * received one.
     */
    const finishPayment = (settledOrder: any, changeGiven: string) => {
      const receiptOrder = {
        ...settledOrder,
        items: cart,
        paidAmount: totalAmount.toFixed(2),
        paymentMethod:
          payMethod === "split"
            ? "Split (Cash + MoMo)"
            : payMethod === "momo"
            ? "Mobile Money (MoMo)"
            : "Cash",
        referenceNumber: payloadReference,
        cashTendered: payloadCashTendered,
        changeGiven,
        splitDetails:
          payMethod === "split"
            ? {
                cashAmount: payloadCashAmount?.toFixed(2),
                momoAmount: payloadMomoAmount?.toFixed(2),
              }
            : undefined,
      };

      setShowPayModal(false);
      clearCart();
      if (onOrderCreated) onOrderCreated();

      if (cart.length > 0) {
        setKitchenTicketOrder(buildKitchenTicket(settledOrder, cart));
        setPendingReceipt(receiptOrder);
        setCartOpen(false);
        setShowKitchenTicket(true);
      } else {
        setLastCompletedOrder(receiptOrder);
        setShowReceipt(true);
      }
    };

    /**
     * The bill exists on the server the moment this is set. It matters in the
     * catch below: if the order was created and only the payment failed, we must
     * retry the payment, never re-create the order or fake the money.
     */
    let createdOrder: any = null;

    try {
      const orderData = await apiFetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderPayload),
      });
      if (!orderData.success) {
        notify(orderData.error || "Failed to create order", "error");
        setIsSubmitting(false);
        return;
      }

      createdOrder = orderData.order;

      // A complimentary order is already settled by the server at GH₵0.00 —
      // there is no tender to record, so skip the payment call entirely and
      // go straight to printing the kitchen docket.
      if (isComplimentary) {
        const compReceipt = {
          ...createdOrder,
          items: createdOrder.items?.length ? createdOrder.items : cart,
          paidAmount: "0.00",
          paymentMethod: "COMPLIMENTARY",
          changeGiven: "0.00",
        };

        setShowPayModal(false);
        const docketItems = cart;
        clearCart();
        if (onOrderCreated) onOrderCreated();
        setKitchenTicketOrder(buildKitchenTicket(createdOrder, docketItems));
        setPendingReceipt(compReceipt);
        setCartOpen(false);
        setShowKitchenTicket(true);
        setIsSubmitting(false);
        return;
      }

      // Now process payment
      const payData = await apiFetch(`/api/orders/${createdOrder.id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: totalAmount.toFixed(2),
          paymentMethod: payMethod,
          cashTendered: payloadCashTendered,
          referenceNumber: payloadReference,
          cashAmount: payloadCashAmount,
          momoAmount: payloadMomoAmount,
          userId: currentUser.id,
          releaseTable: true,
          // Stable per attempt: the server replays instead of re-charging.
          idempotencyKey: payAttemptKey(),
        }),
      });
      if (payData.success) {
        // Settled: the next tender on this ticket is a new attempt, not a retry.
        payAttemptRef.current = null;
        finishPayment(createdOrder, String(payData.changeGiven ?? "0.00"));
      } else {
        // Nothing was recorded, so nothing is claimed. The order stays open and
        // the till keeps its ticket, ready to take the tender again.
        notify(payData.error || "Payment failed — no money was recorded.", "error");
      }
    } catch (e: any) {
      if (!createdOrder) {
        // The order never reached the server (or the answer never came back).
        // It is queued through the same de-duplicating path as a menu order, so
        // the kitchen still gets it and the sale cannot be lost. It is queued
        // UNPAID on purpose: only the server may mark money as collected.
        const stored = queueOfflineOrder({
          ...orderPayload,
          clientTimestamp: Date.now(),
          paidAmount: 0,
          paymentMethod: "unpaid",
          paymentStatus: "unpaid",
          subtotal,
          taxAmount,
          serviceCharge,
          discountAmount: calculatedDiscount,
          tipAmount,
          totalAmount,
        });
        notify(
          stored
            ? `No connection. The order is saved on this device as UNPAID and syncs automatically. You are holding GH₵${totalAmount.toFixed(2)} — record that payment from Orders once the server is back, or the drawer will not match.`
            : `No connection, and this device could not store the order. The ticket is still on screen — you are holding GH₵${totalAmount.toFixed(2)}; write the order down and re-ring it when there is signal.`,
          stored ? "warn" : "error"
        );
        if (stored) {
          clearCart();
          setShowPayModal(false);
        }
      } else {
        // The answer never arrived, so the tender may or may not have landed.
        // Ask the server before the cashier takes money a second time — and
        // because this attempt carries a retry key, asking twice is safe even
        // if the first one did get through.
        let accountedFor = false;
        let recoveredChange = "0.00";
        try {
          const checkRes = await fetch(`/api/orders/${createdOrder.id}`);
          if (checkRes.ok) {
            const checked = await checkRes.json();
            const before = Number(createdOrder.paidAmount || 0);
            const after = Number(checked?.order?.paidAmount || 0);
            if (after > before) {
              accountedFor = true;
              const tendered = payloadCashTendered !== null ? Number(payloadCashTendered) : totalAmount;
              const cashPortion =
                payMethod === "split" ? Number(payloadCashAmount || 0) : payMethod === "cash" ? totalAmount : 0;
              recoveredChange = (tendered - cashPortion).toFixed(2);
            }
          }
        } catch {
          /* audit-ok: still unreachable — the message below says exactly that, and the payment key keeps a retry safe */
          /* still unreachable — the message below says exactly that */
        }

        if (accountedFor) {
          notify("The payment did go through — the answer was lost on the way back. Nothing needs re-entering.", "ok");
          finishPayment(createdOrder, recoveredChange);
        } else {
          notify(
            `Could not confirm the payment (${e?.message || "connection lost"}). The bill stands on the system at GH₵${totalAmount.toFixed(2)} and no money has been claimed. Press Record payment again — the same tender is never taken twice — or check Order History first.`,
            "error"
          );
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApplyModifierModal = () => {
    if (!selectedItemForMod) return;

    // Collect chosen modifier options
    const chosenOptions: any[] = [];
    Object.values(itemModSelections).forEach((opt: any) => {
      if (opt) chosenOptions.push(opt);
    });

    addItemToCart(selectedItemForMod, chosenOptions, itemSpecialNotes);
    setSelectedItemForMod(null);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-neutral-950">
      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden relative">
      {/* LEFT/CENTER: Ghanaian Menu Items & Categories */}
      <div className="flex-1 flex flex-col h-full border-r border-neutral-800 overflow-hidden">
        {/* Top search & Filter bar */}
        <div className="p-4 bg-neutral-900 border-b border-neutral-800 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search menu items, dishes, drinks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-sm text-white placeholder-neutral-400 focus:outline-none focus:border-amber-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Table Indicator if table active */}
          {selectedTableId && (
            <div className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center gap-2 text-xs font-semibold text-amber-400">
              <span>Ordering for Table #{selectedTableId}</span>
              <button
                onClick={() => setSelectedTableId(null)}
                className="text-neutral-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Category Pills */}
        <div className="px-4 py-3 bg-neutral-900/50 border-b border-neutral-800 flex items-center gap-2 overflow-x-auto custom-scrollbar shrink-0">
          <button
            onClick={() => setSelectedCategory("all")}
            className={`px-5 h-12 rounded-xl text-sm font-bold whitespace-nowrap transition-all active:scale-95 ${
              selectedCategory === "all"
                ? "bg-amber-500 text-black shadow-md shadow-amber-500/20"
                : "bg-neutral-800 text-neutral-300 hover:bg-neutral-750 hover:text-white"
            }`}
          >
            All Dishes ({menuItems.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-5 h-12 rounded-xl text-sm font-bold whitespace-nowrap transition-all active:scale-95 ${
                selectedCategory === cat.id
                  ? "bg-amber-500 text-black shadow-md shadow-amber-500/20"
                  : "bg-neutral-800 text-neutral-300 hover:bg-neutral-750 hover:text-white"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Item Cards Grid */}
        <div className="flex-1 overflow-y-auto p-4 pb-44 xl:pb-4 custom-scrollbar">
          {/* Cards never shrink below ~9.75rem: on a 10–13" till the old
              fixed column counts squeezed dishes to ~110px slivers with
              clipped names (field report, Oct 2026). auto-fill trades
              column count for a guaranteed tappable card size instead. */}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(9.75rem,1fr))] gap-4">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={() => handleItemClick(item)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleItemClick(item);
                  }
                }}
                className="group relative bg-neutral-900 hover:bg-neutral-850 active:bg-neutral-800 border border-neutral-800 hover:border-amber-500/50 active:border-amber-500 rounded-2xl p-3.5 flex flex-col justify-between cursor-pointer transition-all duration-150 hover:shadow-xl hover:shadow-amber-500/5 select-none"
              >
                <div>
                  {/* Photo with badges */}
                  <div className="relative w-full h-32 rounded-xl overflow-hidden bg-neutral-800 mb-3">
                    {item.imageUrl ? (
                      <Image unoptimized width={400} height={300}
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-neutral-600">
                        <Coffee className="w-8 h-8" />
                      </div>
                    )}
                    {item.hasRecipe && (
                      <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-xs text-[0.625rem] text-amber-300 font-medium flex items-center gap-1 border border-amber-500/30">
                        <ChefHat className="w-3 h-3" />
                        <span>Recipe</span>
                      </div>
                    )}
                    <div className="absolute bottom-2 right-2 px-2.5 py-1 rounded-lg bg-neutral-950/85 backdrop-blur-xs text-[0.8125rem] font-bold text-emerald-400 border border-neutral-700">
                      GH₵{Number(item.price).toFixed(2)}
                    </div>
                  </div>

                  <h4 className="font-bold text-neutral-50 text-[0.84375rem] leading-snug line-clamp-2">
                    {item.name}
                  </h4>
                  {item.sku && (
                    <div className="text-[0.625rem] text-neutral-500 mt-0.5 font-mono">
                      {item.sku}
                    </div>
                  )}
                </div>

                <div className="mt-3 pt-2.5 border-t border-neutral-800/80 flex items-center justify-between text-[0.71875rem] text-neutral-400">
                  <span className="capitalize text-neutral-500">{item.station || "Kitchen"}</span>
                  <span className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 group-hover:bg-amber-500 group-hover:text-black flex items-center justify-center font-bold transition text-lg leading-none">
                    +
                  </span>
                </div>
              </div>
            ))}
          </div>

          {filteredItems.length === 0 && (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-neutral-500">
              <Search className="w-10 h-10 mb-2 opacity-40" />
              <p className="text-sm font-medium">No dishes match your search.</p>
              <p className="text-xs text-neutral-600 mt-1">Try changing category or search terms.</p>
            </div>
          )}
        </div>
      </div>

      {/* PHONE CART BAR — the running total is the number a cashier must never
          have to hunt for, and it is the only way into the order panel when the
          panel lives in a sheet. */}
      <button
        onClick={() => setCartOpen(true)}
        className={`xl:hidden fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] md:bottom-0 z-20 min-h-16 px-4 flex items-center gap-3 bg-neutral-900/95 backdrop-blur border-t border-neutral-700 shadow-[0_-8px_24px_rgba(0,0,0,0.55)] transition-transform ${
          cartOpen ? "translate-y-full" : "translate-y-0"
        }`}
        aria-label={`Open the order: ${cartCount} items, GH₵${totalAmount.toFixed(2)}`}
      >
        <span className="relative shrink-0 w-11 h-11 rounded-xl bg-amber-500 text-black flex items-center justify-center">
          <ShoppingCart className="w-5 h-5" strokeWidth={2.5} />
          {cartCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-rose-500 text-white text-[0.6875rem] font-bold flex items-center justify-center">
              {cartCount}
            </span>
          )}
        </span>
        <span className="flex-1 text-left min-w-0">
          <span className="block text-[0.6875rem] font-bold tracking-[0.12em] text-neutral-500 uppercase">
            Open order
          </span>
          <span className="block text-base font-bold text-white truncate">
            {cartCount === 0 ? "No items yet" : `${cartCount} item${cartCount === 1 ? "" : "s"}`}
            {cartCount > 0 ? ` · GH₵${totalAmount.toFixed(2)}` : ""}
          </span>
        </span>
        <span className="shrink-0 h-11 px-3.5 rounded-xl bg-neutral-800 border border-neutral-700 text-white font-bold text-sm flex items-center gap-1.5">
          View <ChevronUp className="w-4 h-4" />
        </span>
      </button>

      {/* Backdrop for the phone sheet. Sits under the sheet, over the bar. */}
      {cartOpen && (
        <div
          className="xl:hidden fixed inset-0 z-30 bg-black/60 backdrop-blur-[2px]"
          onClick={() => setCartOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* RIGHT: Active Order Cart & Totals Panel.
          md and up: the in-flow right-hand column. Below md: a slide-up sheet
          with its own grab handle and close button. Same element either way. */}
      <div
        className={`bg-neutral-900 flex flex-col shrink-0 transition-all duration-200 xl:h-full xl:w-96 xl:border-l xl:border-neutral-800 max-xl:fixed max-xl:z-30 max-xl:shadow-2xl max-xl:border-neutral-700 max-md:inset-x-0 max-md:bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] max-md:rounded-t-3xl max-md:border-t max-md:max-h-[85dvh] md:max-xl:top-0 md:max-xl:bottom-0 md:max-xl:right-0 md:max-xl:w-[min(26rem,94vw)] md:max-xl:border-l ${
          cartOpen
            ? "max-xl:visible max-md:translate-y-0 md:max-xl:translate-x-0"
            : "max-xl:invisible max-xl:pointer-events-none max-md:translate-y-full md:max-xl:translate-x-full"
        }`}
      >
        {/* Sheet header — phones and tablets, wherever the panel overlays. */}
        <div className="xl:hidden shrink-0 px-4 pt-2.5 pb-2 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCartOpen(false)}
              className="h-11 w-11 rounded-xl bg-neutral-800 border border-neutral-700 text-neutral-200 flex items-center justify-center transition active:bg-neutral-700"
              aria-label="Close the order panel"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
            <div className="flex-1 min-w-0 text-center">
              <div className="text-[0.6875rem] font-bold tracking-[0.12em] text-neutral-500 uppercase">
                Open order
              </div>
              <div className="text-sm font-bold text-white truncate">
                {cartCount} item{cartCount === 1 ? "" : "s"} · GH₵{totalAmount.toFixed(2)}
              </div>
            </div>
            <div className="w-11" />
          </div>
          <div className="mt-1.5 h-1.5 w-12 mx-auto rounded-full bg-neutral-700" />
        </div>
        {/* Order Meta Header — deliberately compact (field report, Oct 2026):
            the old labelled fields ate ~230px and squeezed the ticket items
            into a sliver staff had to scroll to. Labels are sr-only now; the
            placeholders carry the meaning. Items + checkout get the height. */}
        <div className="p-3 border-b border-neutral-800 space-y-2 shrink-0">
          {/* Order Type Selector — Room Service is distinct from restaurant
              table dining because the GH₵ room charge applies only there. */}
          <div className="flex gap-1 bg-neutral-950 p-1 rounded-xl border border-neutral-800 text-[0.6875rem] font-bold">
            {([
              ["dine_in", "Table"],
              ["room_service", "Room Service"],
              ["takeaway", "Takeaway"],
              ["delivery", "Delivery"],
            ] as const).map(([type, label]) => (
              <button
                key={type}
                onClick={() => {
                  setOrderType(type);
                  if (type !== "dine_in") setSelectedTableId(null);
                  if (type !== "room_service") setIsComplimentary(false);
                  if (type !== "room_service") setRoomNumber("");
                }}
                className={`flex-1 h-11 px-0.5 rounded-lg transition active:scale-[0.97] ${
                  orderType === type
                    ? type === "room_service"
                      ? "bg-sky-400 text-black shadow-xs"
                      : "bg-amber-500 text-black shadow-xs"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Table / Room Number / Guest contact */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {orderType === "dine_in" ? (
              <div>
                <label className="sr-only">
                  Table Number
                </label>
                <select
                  value={selectedTableId || ""}
                  onChange={(e) => setSelectedTableId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-2.5 h-11 text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="">Select Table...</option>
                  {tables.map((tbl) => (
                    <option key={tbl.id} value={tbl.id}>
                      {tbl.tableNumber} ({tbl.capacity}p - {tbl.status})
                    </option>
                  ))}
                </select>
              </div>
            ) : orderType === "room_service" ? (
              <div>
                <label className="sr-only">
                  Hotel Room Number *
                </label>
                <input
                  type="text"
                  value={roomNumber}
                  onChange={(e) => setRoomNumber(e.target.value)}
                  placeholder="Room · e.g. 204 *"
                  className="w-full bg-neutral-800 border border-sky-500/40 rounded-lg px-3 h-11 text-white font-bold placeholder:text-neutral-500 focus:outline-none focus:border-sky-400"
                />
              </div>
            ) : (
              <div>
                <label className="sr-only">
                  Guest Phone (optional)
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="024 410 0000"
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg pl-9 pr-2 h-11 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="sr-only">
                Guest Name
              </label>
              <div className="relative">
                <User className="w-3 h-3 text-neutral-500 absolute left-2 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Walk-in Guest"
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg pl-6 pr-2 h-11 text-white placeholder:text-neutral-500 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>
          <input
            type="text"
            value={orderNotes}
            onChange={(e) => setOrderNotes(e.target.value)}
            placeholder="Order note (prints on kitchen docket) — e.g. extra shito"
            aria-label="Order note (prints on kitchen docket)"
            className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-2.5 h-10 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Cart Item List — the ONLY part of the panel that scrolls. */}
        <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2 custom-scrollbar">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-neutral-500 p-6">
              <Receipt className="w-12 h-12 mb-2 opacity-30 text-amber-500" />
              <p className="text-sm font-semibold text-neutral-300">Ticket is empty</p>
              <p className="text-xs text-neutral-500 mt-1">Tap Ghanaian dishes on the left to start the order</p>
            </div>
          ) : (
            cart.map((it, idx) => (
              <div
                key={it.cartItemId || idx}
                className="bg-neutral-855 border border-neutral-750 rounded-lg px-2.5 py-2 text-sm"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="flex-1 font-semibold text-neutral-100 text-[0.8125rem] leading-tight">
                    {it.itemName}
                  </span>
                  <span className="font-mono font-bold text-neutral-200 text-[0.8125rem] whitespace-nowrap">
                    GH₵{Number(it.totalPrice).toFixed(2)}
                  </span>
                </div>
                {it.modifiers && it.modifiers.length > 0 && (
                  <div className="text-[0.6875rem] text-amber-400/90 mt-0.5">
                    {it.modifiers.map((m: any, mIdx: number) => (
                      <span key={mIdx} className="mr-2">
                        + {m.name || m.optionName}
                      </span>
                    ))}
                  </div>
                )}
                {it.specialInstructions && (
                  <div className="text-[0.625rem] text-neutral-400 italic mt-0.5">
                    * {it.specialInstructions}
                  </div>
                )}

                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[0.625rem] text-neutral-500">
                    GH₵{Number(it.unitPrice).toFixed(2)} ea
                  </span>
                  {/* Steppers stay finger-sized (the large display sizes floor
                      tappables at 40px via globals.css); compactness comes
                      from the single-row layout, not from shrinking targets. */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateQuantity(idx, -1)}
                      aria-label="Decrease quantity"
                      className="w-8 h-8 rounded-lg bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-600 text-neutral-200 flex items-center justify-center transition active:scale-95"
                    >
                      <Minus className="w-4 h-4" strokeWidth={3} />
                    </button>
                    <span className="w-6 text-center font-bold text-white font-mono text-sm">
                      {it.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(idx, 1)}
                      aria-label="Increase quantity"
                      className="w-8 h-8 rounded-lg bg-neutral-800 hover:bg-neutral-700 active:bg-amber-500 active:text-black text-neutral-200 flex items-center justify-center transition active:scale-95"
                    >
                      <Plus className="w-4 h-4" strokeWidth={3} />
                    </button>
                    <button
                      onClick={() =>
                        setPendingConfirm({
                          title: `Remove ${it.itemName}?`,
                          message: `This line (${it.quantity} × GH₵${Number(it.unitPrice).toFixed(2)}) will be taken off the ticket.`,
                          confirmLabel: "Remove item",
                          action: () => removeCartItem(idx),
                        })
                      }
                      aria-label="Remove item"
                      className="ml-1 w-8 h-8 rounded-lg text-neutral-500 hover:text-rose-400 hover:bg-rose-500/10 flex items-center justify-center transition"
                      title="Remove item (asks first)"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Order Calculations & Checkout Bar — shrink-0: totals and Settle
            are always on screen; the panel never scrolls to reach them. */}
        <div className="p-3 bg-neutral-900 border-t border-neutral-800 space-y-2.5 shrink-0">
          {/* Quick Discount & Tip Triggers */}
          <div className="flex gap-2 text-xs">
            <button
              onClick={() => {
                setCartOpen(false);
                setShowDiscountModal(true);
              }}
              className={`flex-1 h-11 px-2 rounded-xl border flex items-center justify-center gap-1.5 font-semibold text-[0.78125rem] transition active:scale-95 ${
                calculatedDiscount > 0
                  ? "bg-amber-500/10 border-amber-500/40 text-amber-400"
                  : "bg-neutral-800 border-neutral-700 text-neutral-300 hover:bg-neutral-750"
              }`}
            >
              <Percent className="w-3.5 h-3.5" />
              <span>
                {calculatedDiscount > 0 ? `-GH₵${calculatedDiscount.toFixed(2)} Disc` : "Discount"}
              </span>
            </button>

            {/* Quick Tip selection */}
            <div className="flex-1 flex gap-1">
              {[0.05, 0.10, 0.15].map((pct) => {
                const tipVal = subtotal * pct;
                const isSelected = Math.abs(tipAmount - tipVal) < 0.05;
                return (
                  <button
                    key={pct}
                    onClick={() => setTipAmount(isSelected ? 0 : tipVal)}
                    className={`flex-1 h-11 rounded-xl border text-[0.8125rem] font-bold transition active:scale-95 ${
                      isSelected
                        ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                        : "bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-white"
                    }`}
                  >
                    {pct * 100}%
                  </button>
                );
              })}
            </div>
          </div>

          {/* Complimentary breakfast toggle */}
          {orderType === "room_service" && billingConfig.compBreakfastEnabled && (
            <button
              onClick={() => {
                  setCartOpen(false);
                  return isComplimentary ? setIsComplimentary(false) : setShowCompModal(true);
                }}
              className={`w-full h-11 rounded-xl border text-[0.78125rem] font-bold flex items-center justify-center gap-2 transition active:scale-[0.98] ${
                isComplimentary
                  ? "bg-sky-500/20 border-sky-400 text-sky-200"
                  : "bg-neutral-800 border-neutral-700 text-neutral-300 hover:bg-neutral-750"
              }`}
              title="Mark this order as a free breakfast for a room guest"
            >
              <Coffee className="w-4 h-4 shrink-0" />
              <span>
                {isComplimentary ? "✓ Complimentary Breakfast — tap to undo" : "Complimentary Breakfast (GH₵0.00)"}
              </span>
            </button>
          )}

          {/* Subtotals Breakdown (Ghanaian Tax + Room Charge) */}
          <div className="space-y-1 text-xs text-neutral-400">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="font-mono text-neutral-200">GH₵{subtotal.toFixed(2)}</span>
            </div>
            {calculatedDiscount > 0 && !isComplimentary && (
              <div className="flex justify-between text-amber-400 font-medium">
                <span>Discount:</span>
                <span className="font-mono">-GH₵{calculatedDiscount.toFixed(2)}</span>
              </div>
            )}

            {/* Room-service charge — not applied to restaurant-table dining,
                takeaway or delivery. */}
            {orderType === "room_service" && !isComplimentary && (
              <div className="flex justify-between text-sky-300 font-bold">
                <span>Room Service Charge (Room {roomNumber || "—"}):</span>
                <span className="font-mono">GH₵{roomCharge.toFixed(2)}</span>
              </div>
            )}

            <div className="flex justify-between">
              <span>GRA VAT ({billingConfig.taxRatePercent}%):</span>
              <span className="font-mono text-neutral-200">GH₵{taxAmount.toFixed(2)}</span>
            </div>
            {tipAmount > 0 && !isComplimentary && (
              <div className="flex justify-between text-emerald-400 font-medium">
                <span>Tip:</span>
                <span className="font-mono">+GH₵{tipAmount.toFixed(2)}</span>
              </div>
            )}

            {isComplimentary ? (
              <div className="pt-2 border-t border-neutral-800 space-y-1">
                <div className="flex justify-between items-baseline font-bold text-sky-300 text-base">
                  <span>COMPLIMENTARY:</span>
                  <span className="font-mono text-lg">GH₵0.00</span>
                </div>
                <div className="flex justify-between text-[0.6875rem] text-neutral-500">
                  <span>Food value given free:</span>
                  <span className="font-mono">GH₵{fromCents(pricing.compValueCents)}</span>
                </div>
              </div>
            ) : (
              <div className="flex justify-between items-baseline pt-2 border-t border-neutral-800 font-bold text-white text-base">
                <span>Total Payable:</span>
                <span className="font-mono text-amber-400 text-lg">GH₵{totalAmount.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Action Buttons — Settle is the hero; docket + drawer + clear sit
              side-by-side underneath for one-thumb till operation. */}
          <div className="space-y-2.5 pt-1">
            {isComplimentary ? (
              /* A comp order has nothing to collect, so it is sent straight
                 through — no payment modal, no tender step. */
              <button
                onClick={handleProcessPayment}
                disabled={cart.length === 0 || isSubmitting}
                className="w-full h-14 px-4 bg-sky-600 hover:bg-sky-500 active:bg-sky-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-2xl text-[0.9375rem] font-bold flex items-center justify-center gap-2.5 shadow-lg shadow-sky-600/25 transition active:scale-[0.98]"
              >
                <Coffee className="w-6 h-6 shrink-0" />
                <span>{isSubmitting ? "Sending…" : "Send Comp Order · GH₵0.00"}</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  setCashTendered(totalAmount.toFixed(2));
                  const half = (Math.round((totalAmount / 2) * 100) / 100).toFixed(2);
                  setSplitCashAmount(half);
                  setSplitMomoAmount((totalAmount - Number(half)).toFixed(2));
                  setSplitCashTendered(half);
                  setMomoRef("");
                  setCartOpen(false);
                  setShowPayModal(true);
                }}
                disabled={cart.length === 0 || isSubmitting}
                className="w-full h-14 px-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-2xl text-[0.9375rem] font-bold flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-600/25 transition active:scale-[0.98]"
              >
                <DollarSign className="w-6 h-6 text-amber-300 shrink-0" />
                <span>Settle Bill · GH₵{totalAmount.toFixed(2)}</span>
              </button>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleSendToKitchen}
                disabled={cart.length === 0 || isSubmitting}
                className="h-12 px-3 bg-neutral-800 hover:bg-neutral-750 active:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed border border-neutral-700 text-white rounded-2xl text-[0.75rem] font-bold flex items-center justify-center gap-2 transition active:scale-[0.98]"
                title="Print the kitchen docket without taking payment"
              >
                <Printer className="w-5 h-5 text-amber-400 shrink-0" />
                <span>Kitchen Docket</span>
              </button>
              <button
                onClick={requestNewTicket}
                disabled={cart.length === 0 || isSubmitting}
                className="h-12 px-3 bg-neutral-800 hover:bg-neutral-750 border border-neutral-700 text-neutral-300 rounded-2xl text-[0.75rem] font-bold flex items-center justify-center gap-2 transition active:scale-[0.98] disabled:opacity-40"
                title="Clear the current ticket (asks first)"
              >
                <Trash2 className="w-5 h-5 shrink-0" />
                <span>Clear Ticket</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL 1: Modifier & Add-on Selection */}
      {selectedItemForMod && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl flex flex-col max-h-[90dvh] my-auto">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-base font-bold text-white">{selectedItemForMod.name}</h3>
                <p className="text-xs text-neutral-400 mt-0.5">Customize protein, pepper preference, and sides</p>
              </div>
              <button
                onClick={() => setSelectedItemForMod(null)}
                className="p-1 text-neutral-400 hover:text-white rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
              {selectedItemForMod.modifiers?.map((mod: any) => (
                <div key={mod.id} className="bg-neutral-850 border border-neutral-800 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-neutral-200">
                    <span>{mod.name}</span>
                    {mod.isRequired && <span className="text-[0.625rem] text-rose-400 font-bold">*Required</span>}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {mod.options?.map((opt: any) => {
                      const isSelected = itemModSelections[mod.id]?.id === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() =>
                            setItemModSelections({
                              ...itemModSelections,
                              [mod.id]: isSelected ? null : opt,
                            })
                          }
                          className={`p-2.5 rounded-lg border text-left text-xs transition flex items-center justify-between ${
                            isSelected
                              ? "bg-amber-500/20 border-amber-500 text-amber-300 font-semibold"
                              : "bg-neutral-800 border-neutral-700/80 text-neutral-300 hover:bg-neutral-750"
                          }`}
                        >
                          <span>{opt.name}</span>
                          {Number(opt.priceDelta) > 0 && (
                            <span className="font-mono text-neutral-400">
                              +GH₵{Number(opt.priceDelta).toFixed(2)}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div>
                <label className="text-xs font-medium text-neutral-300 block mb-1">
                  Special Kitchen Preparation Instructions
                </label>
                <textarea
                  rows={2}
                  value={itemSpecialNotes}
                  onChange={(e) => setItemSpecialNotes(e.target.value)}
                  placeholder="e.g., Extra shito in separate cup, fry plantain soft, no onions on kebab..."
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-neutral-800 flex justify-end gap-3">
              <button
                onClick={() => setSelectedItemForMod(null)}
                className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyModifierModal}
                className="px-5 py-2 text-xs font-bold bg-amber-500 text-black hover:bg-amber-400 rounded-xl shadow-xs transition"
              >
                Add to Ticket
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Discount Modal */}
      {showDiscountModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-sm p-5 shadow-2xl space-y-4 max-h-[92dvh] overflow-y-auto my-auto">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Percent className="w-4 h-4 text-amber-400" />
              <span>Apply Order Discount</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-neutral-400 block mb-1">Discount %</label>
                {/* responsive-ok: single-number labels ("5%") stay readable in
                    four columns even at 320px, and bigger presets suit fingers. */}
                <div className="grid grid-cols-4 gap-1.5">
                  {[5, 10, 15, 20].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => {
                        setDiscountPercent(pct);
                        setDiscountAmount(0);
                      }}
                      className={`py-2 rounded-lg border font-semibold ${
                        discountPercent === pct
                          ? "bg-amber-500 text-black border-amber-500"
                          : "bg-neutral-800 border-neutral-700 text-neutral-300"
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-neutral-400 block mb-1">Fixed GH₵ Amount</label>
                <input
                  type="number"
                        inputMode="decimal"
                  step="1.0"
                  value={discountAmount || ""}
                  onChange={(e) => {
                    setDiscountAmount(Number(e.target.value));
                    setDiscountPercent(0);
                  }}
                  placeholder="0.00"
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-neutral-400 block mb-1">Discount Reason</label>
                <input
                  type="text"
                  value={discountReason}
                  onChange={(e) => setDiscountReason(e.target.value)}
                  placeholder="e.g. Guest Discount, Staff Discount"
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
              <button
                onClick={() => {
                  setDiscountPercent(0);
                  setDiscountAmount(0);
                  setShowDiscountModal(false);
                }}
                className="px-3 py-1.5 text-xs text-rose-400 hover:text-rose-300"
              >
                Clear Discount
              </button>
              <button
                onClick={() => setShowDiscountModal(false)}
                className="px-4 py-1.5 text-xs font-semibold bg-amber-500 text-black rounded-lg"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2b: Complimentary Breakfast confirmation */}
      {showCompModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-sm p-5 shadow-2xl space-y-4 max-h-[92dvh] overflow-y-auto my-auto">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-sky-500/20 border border-sky-500/40 text-sky-300 flex items-center justify-center shrink-0">
                <Coffee className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Complimentary Breakfast</h3>
                <p className="text-xs text-neutral-400">Guest pays GH₵0.00</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/30 text-[0.71875rem] text-sky-100 space-y-1">
              <p>
                The order will be recorded at <strong>GH₵0.00</strong> — no VAT and no room charge.
              </p>
              <p className="text-sky-200/80">
                Stock is still deducted and the kitchen docket still prints, because the food is
                genuinely being served. Every comp is written to the audit log for management review.
              </p>
            </div>

            <div>
              <label className="text-xs text-neutral-300 block mb-1">Reason (printed on the docket)</label>
              <input
                type="text"
                value={compReason}
                onChange={(e) => setCompReason(e.target.value)}
                placeholder="Complimentary breakfast — room guest"
                className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500"
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {["Room guest breakfast", "Manager comp", "Goodwill / complaint", "Staff meal"].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setCompReason(r)}
                    className="px-2.5 h-8 rounded-lg bg-neutral-800 hover:bg-neutral-750 border border-neutral-700 text-[0.6875rem] text-neutral-300 transition"
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-neutral-800 text-xs">
              <span className="text-neutral-400">Food value forgone:</span>
              <span className="font-mono font-bold text-amber-400">GH₵{subtotal.toFixed(2)}</span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowCompModal(false)}
                className="flex-1 h-12 rounded-xl bg-neutral-800 text-neutral-200 font-semibold text-sm hover:bg-neutral-750 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setIsComplimentary(true);
                  setShowCompModal(false);
                  // A free order has no tender, so clear any payment inputs.
                  setTipAmount(0);
                }}
                className="flex-1 h-12 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm transition"
              >
                Mark Comp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Pay & Settle Modal (Cash, MoMo, or Split) */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 max-h-[92dvh] overflow-y-auto my-auto">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-white">Settle Bill</h3>
                <p className="text-xs text-neutral-400">Total Payable: GH₵{totalAmount.toFixed(2)}</p>
              </div>
              <button
                onClick={() => setShowPayModal(false)}
                className="p-1 text-neutral-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Payment Method Selector — Cash, MoMo, or Both (Split) */}
            <div className="grid grid-cols-3 gap-2 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setPaymentMethod("cash")}
                className={`h-16 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 transition active:scale-[0.97] ${
                  paymentMethod === "cash"
                    ? "bg-emerald-600/20 border-emerald-500 text-emerald-400 font-bold shadow-xs"
                    : "bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-white"
                }`}
              >
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <span>Cash (GH₵)</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod("momo")}
                className={`h-16 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 transition active:scale-[0.97] ${
                  paymentMethod === "momo"
                    ? "bg-amber-500/20 border-amber-500 text-amber-300 font-bold shadow-xs"
                    : "bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-white"
                }`}
              >
                <Smartphone className="w-4 h-4 text-amber-400" />
                <span>MoMo</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPaymentMethod("split");
                  if (!splitCashAmount || Number(splitCashAmount) === 0) {
                    const half = (Math.round((totalAmount / 2) * 100) / 100).toFixed(2);
                    setSplitCashAmount(half);
                    setSplitMomoAmount((totalAmount - Number(half)).toFixed(2));
                    setSplitCashTendered(half);
                  }
                }}
                className={`h-16 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 transition active:scale-[0.97] ${
                  paymentMethod === "split"
                    ? "bg-purple-500/20 border-purple-500 text-purple-300 font-bold shadow-xs"
                    : "bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-white"
                }`}
              >
                <Coins className="w-4 h-4 text-purple-400" />
                <span>Cash + MoMo</span>
              </button>
            </div>

            {/* TAB 1: Cash Details */}
            {paymentMethod === "cash" && (
              <div className="space-y-3 bg-neutral-850 border border-neutral-800 rounded-xl p-4 text-xs">
                <div>
                  <label className="text-neutral-300 block mb-1 font-semibold">Cash Tendered by Customer (GH₵)</label>
                  <input
                    type="number"
                        inputMode="decimal"
                    step="1.00"
                    value={cashTendered}
                    onChange={(e) => setCashTendered(e.target.value)}
                    className="w-full text-xl font-bold font-mono py-2 px-3 bg-neutral-900 border border-neutral-700 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Quick tender pills in Ghanaian Cedi notes.
                    Two columns on phones so each note is a full finger target. */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCashTendered(totalAmount.toFixed(2))}
                    className="h-11 rounded-xl bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-600 text-neutral-100 font-bold text-[0.78125rem] transition active:scale-95"
                  >
                    Exact
                  </button>
                  <button
                    type="button"
                    onClick={() => setCashTendered("100")}
                    className="h-11 rounded-xl bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-600 text-neutral-100 font-bold text-[0.78125rem] transition active:scale-95"
                  >
                    GH₵100
                  </button>
                  <button
                    type="button"
                    onClick={() => setCashTendered("200")}
                    className="h-11 rounded-xl bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-600 text-neutral-100 font-bold text-[0.78125rem] transition active:scale-95"
                  >
                    GH₵200
                  </button>
                  <button
                    type="button"
                    onClick={() => setCashTendered("500")}
                    className="h-11 rounded-xl bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-600 text-neutral-100 font-bold text-[0.78125rem] transition active:scale-95"
                  >
                    GH₵500
                  </button>
                </div>

                {/* Change Given */}
                <div className="pt-2 border-t border-neutral-800 flex justify-between items-baseline font-bold text-sm">
                  <span className="text-neutral-300">Change Due:</span>
                  <span className="text-emerald-400 font-mono text-base">
                    GH₵{Math.max(0, Number(cashTendered || 0) - totalAmount).toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            {/* TAB 2: MoMo Details (Direct indication, no telecom gateway delay) */}
            {paymentMethod === "momo" && (
              <div className="space-y-3 bg-neutral-850 border border-neutral-800 rounded-xl p-4 text-xs">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Cashier verifies MoMo transfer on phone/till</span>
                </div>

                <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-lg text-[0.6875rem] text-neutral-300 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Total MoMo Expected:</span>
                    <span className="font-mono font-bold text-amber-400">GH₵{totalAmount.toFixed(2)}</span>
                  </div>
                  <p className="text-[0.625rem] text-neutral-400 pt-1">
                    Customer transfers to restaurant merchant line / scans table GhQR code. Simply tap confirm below once received.
                  </p>
                </div>

                <div>
                  <label className="text-neutral-300 block mb-1 font-semibold text-[0.6875rem]">
                    Optional MoMo Note / Sender Reference
                  </label>
                  <input
                    type="text"
                    value={momoRef}
                    onChange={(e) => setMomoRef(e.target.value)}
                    placeholder="e.g. MTN MoMo confirmed / Sender name or TxID"
                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            )}

            {/* TAB 3: Split Payment (Cash + MoMo) */}
            {paymentMethod === "split" && (
              <div className="space-y-3 bg-neutral-850 border border-neutral-800 rounded-xl p-4 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-purple-300 text-xs">Split: Cash + MoMo</span>
                  <button
                    type="button"
                    onClick={() => {
                      const half = (Math.round((totalAmount / 2) * 100) / 100).toFixed(2);
                      setSplitCashAmount(half);
                      setSplitMomoAmount((totalAmount - Number(half)).toFixed(2));
                      setSplitCashTendered(half);
                    }}
                    className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-750 text-neutral-300 text-[0.625rem] font-semibold border border-neutral-700"
                  >
                    50 / 50 Split
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-neutral-300 block mb-1 font-semibold text-[0.6875rem]">
                      Cash Portion (GH₵)
                    </label>
                    <input
                      type="number"
                        inputMode="decimal"
                      step="0.50"
                      value={splitCashAmount}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSplitCashAmount(val);
                        const cVal = Number(val || 0);
                        if (cVal >= 0 && cVal <= totalAmount) {
                          setSplitMomoAmount((totalAmount - cVal).toFixed(2));
                        }
                      }}
                      className="w-full font-bold font-mono py-2 px-3 bg-neutral-900 border border-neutral-700 rounded-xl text-emerald-400 text-sm focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="text-neutral-300 block mb-1 font-semibold text-[0.6875rem]">
                      MoMo Portion (GH₵)
                    </label>
                    <input
                      type="number"
                        inputMode="decimal"
                      step="0.50"
                      value={splitMomoAmount}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSplitMomoAmount(val);
                        const mVal = Number(val || 0);
                        if (mVal >= 0 && mVal <= totalAmount) {
                          setSplitCashAmount((totalAmount - mVal).toFixed(2));
                        }
                      }}
                      className="w-full font-bold font-mono py-2 px-3 bg-neutral-900 border border-neutral-700 rounded-xl text-amber-400 text-sm focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                {/* Physical cash note tendered for cash portion */}
                <div>
                  <label className="text-neutral-400 block mb-1 text-[0.6875rem]">
                    Physical Cash Handed by Customer (GH₵)
                  </label>
                  <input
                    type="number"
                        inputMode="decimal"
                    step="1.00"
                    value={splitCashTendered}
                    onChange={(e) => setSplitCashTendered(e.target.value)}
                    placeholder={splitCashAmount || "0.00"}
                    className="w-full font-mono py-1.5 px-3 bg-neutral-900 border border-neutral-700 rounded-xl text-white text-xs focus:outline-none focus:border-purple-500"
                  />
                </div>

                {/* Real-time breakdown status */}
                {(() => {
                  const cPart = Number(splitCashAmount || 0);
                  const mPart = Number(splitMomoAmount || 0);
                  const covered = cPart + mPart;
                  const remaining = totalAmount - covered;
                  const cTendered = Number(splitCashTendered || cPart);
                  const cashChange = cTendered > cPart ? cTendered - cPart : 0;

                  return (
                    <div className="pt-2 border-t border-neutral-800 space-y-1.5 text-xs">
                      <div className="flex justify-between items-center text-[0.6875rem]">
                        <span className="text-neutral-400">Total Covered:</span>
                        <span
                          className={`font-mono font-bold ${
                            Math.abs(remaining) < 0.01 ? "text-emerald-400" : "text-amber-400"
                          }`}
                        >
                          GH₵{covered.toFixed(2)} / GH₵{totalAmount.toFixed(2)}
                        </span>
                      </div>

                      {remaining > 0.01 && (
                        <div className="p-1.5 bg-rose-500/10 border border-rose-500/30 rounded text-[0.6875rem] text-rose-300 font-semibold flex justify-between">
                          <span>Balance still owed:</span>
                          <span className="font-mono">GH₵{remaining.toFixed(2)}</span>
                        </div>
                      )}

                      {cashChange > 0 && (
                        <div className="p-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded text-[0.6875rem] text-emerald-300 font-bold flex justify-between">
                          <span>Cash Change to Return:</span>
                          <span className="font-mono">GH₵{cashChange.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div>
                  <label className="text-neutral-400 block mb-1 text-[0.6875rem]">
                    Optional MoMo Reference / Sender Info
                  </label>
                  <input
                    type="text"
                    value={momoRef}
                    onChange={(e) => setMomoRef(e.target.value)}
                    placeholder="e.g. MoMo received for GH₵ portion"
                    className="w-full px-3 py-1.5 bg-neutral-900 border border-neutral-700 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>
            )}

            {/* Confirm Payment Button */}
            <button
              onClick={handleProcessPayment}
              disabled={
                isSubmitting ||
                (paymentMethod === "cash" && Number(cashTendered || 0) < totalAmount - 0.01) ||
                (paymentMethod === "split" &&
                  (Number(splitCashAmount || 0) <= 0 ||
                    Number(splitMomoAmount || 0) <= 0 ||
                    Number(splitCashAmount || 0) + Number(splitMomoAmount || 0) < totalAmount - 0.01))
              }
              className="w-full h-16 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-2xl text-base shadow-lg shadow-emerald-600/25 transition flex items-center justify-center gap-2.5 active:scale-[0.98]"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {isSubmitting
                  ? "Recording Payment..."
                  : paymentMethod === "momo"
                  ? `Confirm MoMo Payment (GH₵${totalAmount.toFixed(2)})`
                  : paymentMethod === "cash"
                  ? `Confirm Cash Payment (GH₵${totalAmount.toFixed(2)})`
                  : `Confirm Split (GH₵${Number(splitCashAmount || 0).toFixed(2)} Cash + GH₵${Number(splitMomoAmount || 0).toFixed(2)} MoMo)`}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* KITCHEN DOCKET: printed paper ticket sent to the line */}
      {showKitchenTicket && kitchenTicketOrder && (
        <KitchenTicketModal
          isOpen={showKitchenTicket}
          onClose={() => {
            setShowKitchenTicket(false);
            // Reveal the deferred customer receipt after the docket is printed.
            if (pendingReceipt) {
              setLastCompletedOrder(pendingReceipt);
              setPendingReceipt(null);
              setShowReceipt(true);
            }
          }}
          order={kitchenTicketOrder}
        />
      )}

      {/* MODAL 4: Printable Thermal Receipt */}
      {showReceipt && lastCompletedOrder && (
        <ReceiptModal
          isOpen={showReceipt}
          onClose={() => setShowReceipt(false)}
          order={lastCompletedOrder}
        />
      )}

      {/* MODAL 5: Safety net for destructive taps */}
      <ConfirmDialog
        open={!!pendingConfirm}
        title={pendingConfirm?.title || ""}
        message={pendingConfirm?.message || ""}
        confirmLabel={pendingConfirm?.confirmLabel}
        cancelLabel="Go back"
        onCancel={() => setPendingConfirm(null)}
        onConfirm={() => {
          const action = pendingConfirm?.action;
          setPendingConfirm(null);
          action?.();
        }}
      />
      </div>
    </div>
  );
};
