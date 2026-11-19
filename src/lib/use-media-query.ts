"use client";

import { useSyncExternalStore } from "react";

/**
 * Whether a CSS media query matches, kept live. Server render and the first
 * client render answer `false`, so a wide-screen-only layout appears after
 * hydration instead of mismatching it.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Where the new design's top bar shows (md). */
export const MD_UP = "(min-width: 48rem)";
/** Where the new POS layout fits beside its order panel. */
export const LAPTOP_UP = "(min-width: 64rem)";
