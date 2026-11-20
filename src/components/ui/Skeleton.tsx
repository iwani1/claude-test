import React from "react";

/**
 * Loading placeholders for the new design (stage 7): grey blocks shaped like
 * the content that is coming, so a screen keeps its layout while figures
 * load. Hidden from screen readers; the caller keeps a visible or sr-only
 * "Loading…" line for them.
 */
export function SkeletonCards({ count = 4, height = "h-28", min = "14rem" }: { count?: number; height?: string; min?: string }) {
  return (
    <div aria-hidden="true" className="grid gap-3" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${min}, 1fr))` }}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={`${height} rounded-xl border border-ui-border bg-ui-surface p-4 flex flex-col gap-3`}>
          <span className="h-3 w-1/2 rounded-full bg-ui-subtle animate-pulse" />
          <span className="h-6 w-2/3 rounded-md bg-ui-subtle animate-pulse" />
          <span className="h-3 w-3/4 rounded-full bg-ui-subtle animate-pulse" />
        </div>
      ))}
    </div>
  );
}
