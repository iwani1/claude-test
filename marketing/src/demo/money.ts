/**
 * Money and time helpers. Every amount in the demo is an integer number of
 * pesewas (GH₵ 1 = 100 pesewas) — the same rule the real POS follows — so
 * totals never drift by a pesewa.
 */

/** "1,234.50" — number part only. */
export function num(pesewas: number): string {
  const sign = pesewas < 0 ? "-" : "";
  const abs = Math.abs(Math.round(pesewas));
  const whole = Math.floor(abs / 100).toLocaleString("en-GB");
  const frac = String(abs % 100).padStart(2, "0");
  return `${sign}${whole}.${frac}`;
}

/** "GH₵ 1,234.50" */
export function cedi(pesewas: number): string {
  return `GH₵ ${num(pesewas)}`;
}

/** Whole-cedi form for charts and tiles: "GH₵ 12.4k" / "GH₵ 845" */
export function cediShort(pesewas: number): string {
  const v = pesewas / 100;
  if (Math.abs(v) >= 10000) return `GH₵ ${(v / 1000).toFixed(1)}k`;
  return `GH₵ ${Math.round(v).toLocaleString("en-GB")}`;
}

export function pct(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 1000) / 10;
}

export function round(n: number): number {
  return Math.round(n);
}

/** Parse "12.5" → 1250 pesewas (tolerates commas and blanks). */
export function parseCedi(input: string): number {
  const clean = input.replace(/[^0-9.]/g, "");
  if (!clean) return 0;
  const v = Number.parseFloat(clean);
  return Number.isFinite(v) ? Math.round(v * 100) : 0;
}

/* ------------------------------------------------------------------ time */

export function hm(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function dayLabel(ts: number): string {
  return new Date(ts).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

export function longDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export function stamp(ts: number): string {
  const d = new Date(ts);
  return `${d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} ${hm(ts)}`;
}

/** "3 min", "1 h 12 min", "just now" */
export function ago(ts: number, now = Date.now()): string {
  const m = Math.max(0, Math.floor((now - ts) / 60000));
  if (m < 1) return "just now";
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}

export function mmss(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function startOfToday(now = Date.now()): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function at(hours: number, minutes = 0, dayOffset = 0): number {
  const d = new Date(startOfToday());
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hours, minutes, 0, 0);
  return d.getTime();
}

/* ------------------------------------------------------------------- csv */

export function toCSV(rows: (string | number)[][]): string {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(esc).join(",")).join("\n");
}

export function download(filename: string, text: string, type = "text/csv;charset=utf-8"): void {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Deterministic pseudo-random in [0, 1) for synthetic history. */
export function noise(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}
