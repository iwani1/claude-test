import React from "react";

/**
 * An amount in cedis for the new design (stage 7): the figure carries the
 * weight and the currency sign sits smaller beside it, so a column of prices
 * reads as numbers first. Digits are tabular (globals.css).
 */
export function Money({ value, className = "", sign = "" }: { value: number | string; className?: string; sign?: "" | "+" | "−" }) {
  const text = Number(value || 0).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <span className={`whitespace-nowrap ${className}`}>
      {sign}
      <span className="text-[0.72em] font-semibold mr-[0.08em]">GH₵</span>
      {text}
    </span>
  );
}
