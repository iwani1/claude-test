"use client";

import { LoadFailure } from "./LoadFailure";

import React, { useState, useEffect, useCallback } from "react";
import {
  ChefHat,
  Flame,
  Wine,
  Clock,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  Volume2,
  VolumeX,
  Printer,
} from "lucide-react";
import { KitchenTicketModal } from "./KitchenTicketModal";
import { ScrollFadeList } from "@/components/interface-studies";
import { apiErrorMessage, apiFetch } from "@/lib/api-client";
import { notify } from "@/lib/notify";

export const KitchenDisplaySystem: React.FC = () => {
  const [tickets, setTickets] = useState<any[]>([]);
  const [stationFilter, setStationFilter] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  // Reprinting a docket: the kitchen has no screen, so a lost or damaged
  // paper ticket must be re-printed by front-of-house.
  const [reprintTicket, setReprintTicket] = useState<any | null>(null);
  const [showReprintModal, setShowReprintModal] = useState(false);

  // Polling every 5 seconds
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchTickets = useCallback(() => fetch(`/api/kds?station=${stationFilter}`)
    .then(res => { if (!res.ok) throw new Error("Request failed"); return res.json(); })
    .then(data => {
    setLoadError(null);
      if (data.tickets) {
        setTickets(data.tickets);
      }

    }).catch(() => setLoadError("Kitchen tickets could not be loaded. What is shown may be out of date.")), [stationFilter]);

  useEffect(() => {
    fetchTickets();
    const interval = setInterval(() => {
      fetchTickets();
      setCurrentTime(Date.now());
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchTickets]);

  const updateTicketStatus = async (ticketId: number, status: "preparing" | "ready" | "completed") => {
    try {
      const data = await apiFetch("/api/kds", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId, status }),
      });
      if (data.success) {
        fetchTickets();
      } else {
        notify(data.error || "Ticket status was not changed", "error");
      }
    } catch (e) {
      console.error(e);
      notify(apiErrorMessage(e, "Could not reach the server. Ticket status was not changed."), "error");
    }
  };

  const getElapsedMinutes = (dateStr: string) => {
    const elapsedMs = currentTime - new Date(dateStr).getTime();
    return Math.floor(elapsedMs / 60000);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-neutral-950 overflow-hidden">
      <LoadFailure message={loadError} onRetry={fetchTickets} />
      {/* KDS Header */}
      <div className="p-4 bg-neutral-900 border-b border-neutral-800 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-600/20 border border-orange-500/30 text-orange-400 flex items-center justify-center">
            <ChefHat className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span>Kitchen Docket &amp; Progress Board</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </h2>
            <p className="text-xs text-neutral-400">
              The kitchen has no terminal access — track printed dockets, reprint lost slips, and mark orders collected
            </p>
          </div>
        </div>

        {/* Stations Filter */}
        <div className="flex items-center gap-2 text-xs">
          <div className="bg-neutral-950 p-1 rounded-xl border border-neutral-800 flex items-center gap-1">
            <button
              onClick={() => setStationFilter("all")}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                stationFilter === "all" ? "bg-amber-500 text-black" : "text-neutral-400 hover:text-white"
              }`}
            >
              All Lines ({tickets.length})
            </button>
            <button
              onClick={() => setStationFilter("kitchen")}
              className={`px-3 py-1.5 rounded-lg font-semibold transition flex items-center gap-1 ${
                stationFilter === "kitchen" ? "bg-amber-500 text-black" : "text-neutral-400 hover:text-white"
              }`}
            >
              <ChefHat className="w-3.5 h-3.5" />
              <span>Kitchen</span>
            </button>
            <button
              onClick={() => setStationFilter("grill")}
              className={`px-3 py-1.5 rounded-lg font-semibold transition flex items-center gap-1 ${
                stationFilter === "grill" ? "bg-amber-500 text-black" : "text-neutral-400 hover:text-white"
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              <span>Grill</span>
            </button>
            <button
              onClick={() => setStationFilter("bar")}
              className={`px-3 py-1.5 rounded-lg font-semibold transition flex items-center gap-1 ${
                stationFilter === "bar" ? "bg-amber-500 text-black" : "text-neutral-400 hover:text-white"
              }`}
            >
              <Wine className="w-3.5 h-3.5" />
              <span>Bar</span>
            </button>
          </div>

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 text-neutral-400 hover:text-white rounded-lg bg-neutral-800 border border-neutral-700"
            title="Audio alerts"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-neutral-500" />}
          </button>

          <button
            onClick={fetchTickets}
            className="p-2 text-neutral-400 hover:text-white rounded-lg bg-neutral-800 border border-neutral-700"
            title="Refresh tickets"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tickets Board */}
      <div className="flex-1 overflow-x-auto p-4 custom-scrollbar">
        {tickets.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-neutral-500 p-8">
            <CheckCircle2 className="w-16 h-16 text-emerald-500/40 mb-3" />
            <h3 className="text-base font-bold text-neutral-300">No Open Kitchen Dockets</h3>
            <p className="text-xs text-neutral-500 mt-1">
              Printed dockets appear here when front-of-house sends an order to the kitchen.
            </p>
          </div>
        ) : (
          <div className="flex gap-4 items-start pb-4 min-w-max">
            {tickets.map((ticket) => {
              const elapsedMin = getElapsedMinutes(ticket.createdAt);
              const isUrgent = elapsedMin > 15;
              const isReady = ticket.status === "ready";

              return (
                <div
                  key={ticket.id}
                  className={`w-80 bg-neutral-900 border rounded-2xl flex flex-col shadow-2xl overflow-hidden transition-all ${
                    isReady
                      ? "border-emerald-500/80 shadow-emerald-500/10"
                      : isUrgent
                      ? "border-rose-500 shadow-rose-500/10 animate-pulse"
                      : "border-neutral-800"
                  }`}
                >
                  {/* Ticket Header */}
                  <div
                    className={`p-3.5 flex items-center justify-between border-b ${
                      isReady
                        ? "bg-emerald-950/40 border-emerald-800/60"
                        : isUrgent
                        ? "bg-rose-950/40 border-rose-800/60"
                        : "bg-neutral-850 border-neutral-800"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-base text-white">
                          #{ticket.ticketNumber}
                        </span>
                        <span className="px-1.5 py-0.5 rounded-md bg-neutral-800 text-[0.625rem] font-mono font-bold text-amber-400">
                          {ticket.tableNumber}
                        </span>
                      </div>
                      <div className="text-[0.6875rem] text-neutral-400 mt-0.5">
                        {ticket.customerName} ({ticket.orderType})
                      </div>
                    </div>

                    {/* Header actions: reprint docket + timer */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          setReprintTicket(ticket);
                          setShowReprintModal(true);
                        }}
                        className="p-2 rounded-lg bg-orange-600/20 hover:bg-orange-600 text-orange-300 hover:text-white border border-orange-600/40 transition"
                        title="Reprint this kitchen docket"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>

                      <div
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 ${
                        isReady
                          ? "bg-emerald-500 text-black"
                          : isUrgent
                          ? "bg-rose-500 text-white"
                          : elapsedMin > 8
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                          : "bg-neutral-800 text-neutral-300"
                      }`}
                    >
                        <Clock className="w-3.5 h-3.5" />
                        <span>{elapsedMin}m</span>
                      </div>
                    </div>
                  </div>

                  {/* Ticket Items */}
                  <ScrollFadeList className="p-4 space-y-3 flex-1 overflow-y-auto max-h-96 custom-scrollbar">
                    {ticket.items?.map((it: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-2.5 bg-neutral-850/80 rounded-xl border border-neutral-800 text-xs space-y-1.5"
                      >
                        <div className="flex items-start gap-2">
                          <span className="w-6 h-6 rounded-md bg-amber-500/20 text-amber-400 font-bold font-mono text-xs flex items-center justify-center shrink-0">
                            {it.qty || it.quantity || 1}x
                          </span>
                          <span className="font-bold text-neutral-100 flex-1 leading-snug">
                            {it.name || it.itemName}
                          </span>
                        </div>

                        {/* Modifiers */}
                        {it.modifiers && it.modifiers.length > 0 && (
                          <div className="pl-8 text-[0.6875rem] text-amber-300 font-medium">
                            {it.modifiers.map((m: any, mIdx: number) => (
                              <div key={mIdx}>• {m.name || m.optionName}</div>
                            ))}
                          </div>
                        )}

                        {/* Special Instructions Alert */}
                        {(it.notes || it.specialInstructions) && (
                          <div className="mt-1 px-2 py-1 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[0.6875rem] font-semibold flex items-center gap-1.5">
                            <AlertCircle className="w-3 h-3 text-rose-400 shrink-0" />
                            <span>{it.notes || it.specialInstructions}</span>
                          </div>
                        )}
                      </div>
                    ))}

                    {ticket.orderNotes && (
                      <div className="p-2 rounded-lg bg-neutral-800/80 border border-neutral-700 text-[0.6875rem] text-neutral-300">
                        <span className="text-neutral-500 block text-[0.5625rem] uppercase font-bold">
                          Order Note:
                        </span>
                        {ticket.orderNotes}
                      </div>
                    )}
                  </ScrollFadeList>

                  {/* Footer Actions */}
                  <div className="p-3 bg-neutral-850 border-t border-neutral-800 flex gap-2 text-xs">
                    {ticket.status === "pending" && (
                      <button
                        onClick={() => updateTicketStatus(ticket.id, "preparing")}
                        className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl transition"
                      >
                        Start Prep
                      </button>
                    )}

                    {ticket.status === "preparing" && (
                      <button
                        onClick={() => updateTicketStatus(ticket.id, "ready")}
                        className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition flex items-center justify-center gap-1"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Mark Ready</span>
                      </button>
                    )}

                    {ticket.status === "ready" && (
                      <button
                        onClick={() => updateTicketStatus(ticket.id, "completed")}
                        className="flex-1 py-2 bg-neutral-750 hover:bg-neutral-700 text-neutral-200 font-semibold rounded-xl transition"
                      >
                        Dispatch / Clear
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {/* REPRINT KITCHEN DOCKET */}
      {showReprintModal && reprintTicket && (
        <KitchenTicketModal
          isOpen={showReprintModal}
          onClose={() => {
            setShowReprintModal(false);
            setReprintTicket(null);
          }}
          order={reprintTicket}
        />
      )}
    </div>
  );
};
