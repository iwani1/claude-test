"use client";

import { useState, type FormEvent } from "react";
import { CalendarDays } from "lucide-react";
import { notify } from "@/lib/notify";

export type AuditDateRange = { from: string; to: string } | null;

/** Draft dates are applied together; a half-typed range never changes results. */
export function AuditDateRangePicker({ label, onApply, initialRange = null }: {
  label: string;
  onApply: (range: AuditDateRange) => void;
  initialRange?: AuditDateRange;
}) {
  // A picker inside a tab can remount while its parent keeps the applied range.
  const [from, setFrom] = useState(initialRange?.from ?? "");
  const [to, setTo] = useState(initialRange?.to ?? "");

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!from || !to) {
      notify("Choose both From and To dates", "warn");
      return;
    }
    if (from > to) {
      notify("From must be on or before To", "warn");
      return;
    }
    onApply({ from, to });
  }

  return (
    <form onSubmit={apply} aria-label={`${label} date range`} className="flex flex-wrap items-end gap-2 text-xs">
      <CalendarDays aria-hidden="true" className="w-4 h-4 mb-3 text-amber-500 hidden sm:block" />
      <label className="flex flex-col gap-1 text-neutral-300 font-semibold">
        From
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
          className="min-h-11 bg-neutral-800 border border-neutral-700 rounded-xl px-2 text-sm text-white focus:outline-none focus:border-amber-500" />
      </label>
      <label className="flex flex-col gap-1 text-neutral-300 font-semibold">
        To
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
          className="min-h-11 bg-neutral-800 border border-neutral-700 rounded-xl px-2 text-sm text-white focus:outline-none focus:border-amber-500" />
      </label>
      <button type="submit" className="min-h-11 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold">
        Apply dates
      </button>
      <button type="button" onClick={() => { setFrom(""); setTo(""); onApply(null); }}
        className="min-h-11 px-4 rounded-xl border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 text-neutral-100 font-semibold">
        Clear dates
      </button>
      <span className="text-neutral-400 self-center">Whole days, Ghana time (UTC). To is included.</span>
    </form>
  );
}
