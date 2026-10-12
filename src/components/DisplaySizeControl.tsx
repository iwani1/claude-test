"use client";

import { useEffect, useState } from "react";
import { Type } from "lucide-react";

/**
 * Per-terminal display size. Every Tailwind size in this app is rem-based,
 * so raising the root font size scales the entire UI at once — text, button
 * height, gaps and padding together. Terminal screens vary (a 10in bar
 * tablet vs a 15in desk monitor), so the choice is saved per device in
 * localStorage and applied before first paint by the script in layout.tsx.
 */
const SIZES = ["standard", "large", "extra"] as const;
export type DisplaySize = (typeof SIZES)[number];

export const DISPLAY_SIZE_KEY = "pos.displaySize";
export const DEFAULT_DISPLAY_SIZE: DisplaySize = "large";

export const DISPLAY_SIZE_LABEL: Record<DisplaySize, string> = {
  standard: "Standard",
  large: "Large",
  extra: "Extra large",
};

export function readDisplaySize(): DisplaySize {
  try {
    const saved = window.localStorage.getItem(DISPLAY_SIZE_KEY);
    if (saved === "standard" || saved === "extra" || saved === "large") return saved;
  } catch {
    /* private mode — fall through to default */
  }
  return DEFAULT_DISPLAY_SIZE;
}

export function applyDisplaySize(size: DisplaySize) {
  document.documentElement.dataset.displaySize = size;
  try {
    window.localStorage.setItem(DISPLAY_SIZE_KEY, size);
  } catch {
    /* not fatal — the size still applies for this session */
  }
}

/** Tap to cycle Standard → Large → Extra large → Standard. */
export function DisplaySizeControl() {
  const [size, setSize] = useState<DisplaySize>(DEFAULT_DISPLAY_SIZE);

  useEffect(() => {
    const saved = readDisplaySize();
    // Deferred so the first paint matches the server render (same pattern as
    // the orders screen); the pre-paint script has already applied the value
    // to <html>, this only syncs the button label.
    const t = setTimeout(() => setSize(saved), 0);
    return () => clearTimeout(t);
  }, []);

  const cycle = () => {
    const next = SIZES[(SIZES.indexOf(size) + 1) % SIZES.length];
    setSize(next);
    applyDisplaySize(next);
  };

  return (
    <button
      onClick={cycle}
      className="h-11 px-3.5 font-bold rounded-xl bg-neutral-800 hover:bg-neutral-750 border border-neutral-700 text-white flex items-center gap-2 transition active:scale-[0.97] text-[0.8125rem]"
      title={`Text & touch size: ${DISPLAY_SIZE_LABEL[size]} — tap to change`}
      aria-label={`Display size: ${DISPLAY_SIZE_LABEL[size]}. Tap to change.`}
    >
      <Type className="w-5 h-5" />
      <span className="hidden lg:inline">{DISPLAY_SIZE_LABEL[size]}</span>
      <span className="lg:hidden">Aa</span>
    </button>
  );
}
