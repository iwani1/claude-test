/**
 * Storage keys and the pre-paint script for the per-terminal design and theme
 * (see ui-preferences.ts). Kept free of React so the server-rendered
 * layout.tsx can inline the script.
 */
export const UI_DESIGN_KEY = "pos.uiDesign";
export const UI_THEME_KEY = "pos.uiTheme";

export const UI_PREPAINT_SCRIPT =
  `try{var d=localStorage.getItem('${UI_DESIGN_KEY}'),t=localStorage.getItem('${UI_THEME_KEY}'),e=document.documentElement;` +
  `e.dataset.ui=d==='classic'?'classic':'new';e.dataset.uiTheme=t==='dark'?'dark':'light'}` +
  `catch(x){/* audit-ok: a per-device preference; failing keeps the default (new) design */}`;
