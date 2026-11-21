import { useSyncExternalStore } from "react";

import { UI_DESIGN_KEY, UI_THEME_KEY } from "@/lib/ui-preferences-script";

export { UI_DESIGN_KEY, UI_THEME_KEY };

/**
 * Per-terminal look: the classic dark shell, or the new design (top bar,
 * Dreams-style layout, Nov 2026) in a light or dark theme.
 *
 * Since redesign stage 6b the new design is the default: a terminal shows it
 * unless someone chose "Back to the classic design" on it, which is kept.
 * Like the display size, the choice lives in localStorage and is applied to
 * <html> before first paint by the script in layout.tsx, so a screen never
 * flashes the wrong theme.
 *
 *   <html data-ui="classic|new" data-ui-theme="light|dark">
 */
export type UiDesign = "classic" | "new";
export type UiTheme = "light" | "dark";

export const DEFAULT_UI_DESIGN: UiDesign = "new";
export const DEFAULT_UI_THEME: UiTheme = "light";

const listeners = new Set<() => void>();

function read(): { design: UiDesign; theme: UiTheme } {
  if (typeof document === "undefined") return { design: DEFAULT_UI_DESIGN, theme: DEFAULT_UI_THEME };
  const el = document.documentElement;
  return {
    design: el.dataset.ui === "classic" ? "classic" : "new",
    theme: el.dataset.uiTheme === "dark" ? "dark" : "light",
  };
}

// useSyncExternalStore needs a stable snapshot between changes.
let snapshot = { design: DEFAULT_UI_DESIGN as UiDesign, theme: DEFAULT_UI_THEME as UiTheme };
let primed = false;
function getSnapshot() {
  if (!primed) {
    snapshot = read();
    primed = true;
  }
  return snapshot;
}
const SERVER_SNAPSHOT = { design: DEFAULT_UI_DESIGN, theme: DEFAULT_UI_THEME };

function save(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* audit-ok: not fatal — the choice still applies until the page reloads */
  }
}

function commit(next: { design: UiDesign; theme: UiTheme }) {
  const el = document.documentElement;
  el.dataset.ui = next.design;
  el.dataset.uiTheme = next.theme;
  save(UI_DESIGN_KEY, next.design);
  save(UI_THEME_KEY, next.theme);
  snapshot = next;
  primed = true;
  listeners.forEach((fn) => fn());
}

export function setUiDesign(design: UiDesign) {
  commit({ ...getSnapshot(), design });
}

export function setUiTheme(theme: UiTheme) {
  commit({ ...getSnapshot(), theme });
}

/** The terminal's current design and theme; re-renders when either changes. */
export function useUiPreferences() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    getSnapshot,
    () => SERVER_SNAPSHOT,
  );
}
