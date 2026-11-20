"use client";

import React from "react";
import { Banknote, Smartphone } from "lucide-react";

/**
 * The redesign's two chart marks, shared by the dashboard and reports. Colours
 * come from the ui-chart-* tokens, checked with the dataviz palette validator
 * in both themes. Every figure is also written out as text, so nothing is
 * read from colour or bar length alone.
 */

export const cedi = (v: unknown) =>
  `GH₵${Number(v || 0).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** One-series horizontal bars: value written out, hover shows the exact figure. */
export function Bars({ rows, unit }: { rows: { name: string; value: number; sub?: string }[]; unit: (v: number) => string }) {
  const max = Math.max(...rows.map((r) => r.value), 0);
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.name} className="group" title={`${r.name}: ${unit(r.value)}${r.sub ? ` · ${r.sub}` : ""}`}>
          <div className="flex justify-between gap-3 text-[0.8125rem]">
            <span className="font-semibold truncate">{r.name}</span>
            <span className="font-mono text-ui-text-2 shrink-0">
              {unit(r.value)}
              {r.sub ? <span className="text-ui-muted"> · {r.sub}</span> : null}
            </span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-ui-subtle overflow-hidden" aria-hidden="true">
            <div className="h-full rounded-full bg-ui-chart-bar group-hover:opacity-80" style={{ width: `${max > 0 ? Math.max(2, (r.value / max) * 100) : 0}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}


/** Cash vs MoMo (and other) as one stacked bar with a 2px gap, plus a legend
 *  that names each part and gives its amount. */
export function TenderSplit({ cash, momo, other = 0 }: { cash: number; momo: number; other?: number }) {
  const total = cash + momo + other;
  return (
    <div className="space-y-3">
      <div
        className="flex h-4 rounded-full overflow-hidden gap-[2px] bg-ui-surface"
        role="img"
        aria-label={`Cash ${cedi(cash)}, MoMo ${cedi(momo)}${other ? `, other ${cedi(other)}` : ""}`}
      >
        {cash > 0 && <div className="h-full bg-ui-chart-cash" style={{ width: `${(cash / total) * 100}%` }} title={`Cash ${cedi(cash)}`} />}
        {momo > 0 && <div className="h-full bg-ui-chart-momo" style={{ width: `${(momo / total) * 100}%` }} title={`MoMo ${cedi(momo)}`} />}
        {other > 0 && <div className="h-full bg-ui-border-strong" style={{ width: `${(other / total) * 100}%` }} title={`Other ${cedi(other)}`} />}
      </div>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm bg-ui-chart-cash shrink-0" aria-hidden="true" />
          <dt className="text-ui-text-2 inline-flex items-center gap-1">
            <Banknote className="w-3.5 h-3.5" /> Cash
          </dt>
          <dd className="ml-auto font-mono font-bold">{cedi(cash)}</dd>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm bg-ui-chart-momo shrink-0" aria-hidden="true" />
          <dt className="text-ui-text-2 inline-flex items-center gap-1">
            <Smartphone className="w-3.5 h-3.5" /> MoMo
          </dt>
          <dd className="ml-auto font-mono font-bold">{cedi(momo)}</dd>
        </div>
      </dl>
    </div>
  );
}
