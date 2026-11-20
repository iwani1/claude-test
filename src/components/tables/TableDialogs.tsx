"use client";

import React from "react";
import { ArrowRightLeft, Minus, Plus, Users } from "lucide-react";
import { Dialog, DialogHeader, btnPrimary, btnSecondary, fieldCls, labelCls, tile } from "@/components/ui/NewDialog";

/**
 * The Tables screen's dialogs in the new design (redesign stage 4d): move a
 * bill to another table, and add a table. Presentation only: the fields are
 * TableFloorPlan's state and the confirms its handlers (POST /api/tables).
 * As before, a bill can only move to a table that is available.
 */

const tableLabel = (n: unknown) => (/^\d+$/.test(String(n)) ? `Table ${n}` : String(n));

export function MoveBillDialog(p: {
  from: any;
  tables: any[];
  target: number | "";
  onTarget: (id: number) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const options = p.tables.filter((t) => t.id !== p.from.id && t.status === "available");
  return (
    <Dialog label={`Move the bill from ${tableLabel(p.from.tableNumber)}`} onClose={p.onCancel} width="max-w-lg">
      <div className="p-5 space-y-4">
        <DialogHeader icon={<ArrowRightLeft className="w-5 h-5" />} tone="info" title={`Move ${tableLabel(p.from.tableNumber)}'s bill`} sub="Pick a free table. The bill and its kitchen order move with it." onClose={p.onCancel} />
        {options.length === 0 ? (
          <p className="rounded-lg bg-ui-subtle px-3 py-3 text-sm text-ui-text-2">No table is free right now. Free or clear one first.</p>
        ) : (
          <div role="radiogroup" aria-label="Move to" className="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-2">
            {options.map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={p.target === t.id}
                onClick={() => p.onTarget(t.id)}
                className={`${tile(p.target === t.id)} min-h-16 px-3 py-2`}
              >
                <span className="block text-sm font-bold">{tableLabel(t.tableNumber)}</span>
                <span className="text-xs inline-flex items-center gap-1 opacity-80">
                  <Users className="w-3 h-3" /> {t.capacity} seats
                </span>
              </button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={p.onCancel} className={btnSecondary}>
            Cancel
          </button>
          <button type="button" onClick={p.onConfirm} disabled={!p.target} className={btnPrimary}>
            Move bill
          </button>
        </div>
      </div>
    </Dialog>
  );
}

export function AddTableDialog(p: {
  areas: any[];
  areaId: number;
  onArea: (id: number) => void;
  label: string;
  onLabel: (v: string) => void;
  capacity: number;
  onCapacity: (n: number) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}) {
  const setCap = (n: number) => p.onCapacity(Math.min(24, Math.max(1, n)));
  return (
    <Dialog label="Add a table" onClose={p.onCancel} width="max-w-md">
      <form onSubmit={p.onSubmit} className="p-5 space-y-4">
        <DialogHeader icon={<Plus className="w-5 h-5" />} title="Add a table" onClose={p.onCancel} />
        {p.areas.length > 0 && (
          <div>
            <div className={labelCls}>Dining area</div>
            <div role="radiogroup" aria-label="Dining area" className="flex flex-wrap gap-2">
              {p.areas.map((a) => (
                <button key={a.id} type="button" role="radio" aria-checked={p.areaId === a.id} onClick={() => p.onArea(a.id)} className={`${tile(p.areaId === a.id)} h-11 px-4 text-sm font-semibold`}>
                  {a.name}
                </button>
              ))}
            </div>
          </div>
        )}
        <label className="block">
          <span className={labelCls}>Table name or number</span>
          <input required autoFocus value={p.label} onChange={(e) => p.onLabel(e.target.value)} placeholder="e.g. 12, VIP, Pool 3" className={fieldCls} />
        </label>
        <div>
          <div className={labelCls} id="seats-label">
            Seats
          </div>
          <div className="flex items-center gap-3" role="group" aria-labelledby="seats-label">
            <button type="button" onClick={() => setCap(p.capacity - 1)} aria-label="One seat fewer" className="w-12 h-12 rounded-full border border-ui-border-strong flex items-center justify-center">
              <Minus className="w-5 h-5" />
            </button>
            <input
              type="number"
              min={1}
              max={24}
              value={p.capacity}
              onChange={(e) => setCap(Number(e.target.value))}
              aria-label="Seats"
              className="w-20 h-12 rounded-lg border border-ui-border-strong bg-ui-surface text-center text-lg font-bold font-mono text-ui-text"
            />
            <button type="button" onClick={() => setCap(p.capacity + 1)} aria-label="One seat more" className="w-12 h-12 rounded-full bg-ui-primary text-ui-on-primary flex items-center justify-center">
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={p.onCancel} className={btnSecondary}>
            Cancel
          </button>
          <button type="submit" className={btnPrimary}>
            Add table
          </button>
        </div>
      </form>
    </Dialog>
  );
}
