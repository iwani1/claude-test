"use client";

import { X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import type { CatKey, OrderStatus, POStatus, Tone } from "./data";
import { num } from "./money";

/* ------------------------------------------------------------- hooks */

/** Re-render every `ms` milliseconds (clocks, elapsed timers). */
export function useNow(ms = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export function useEsc(onEsc: (() => void) | undefined) {
  useEffect(() => {
    if (!onEsc) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onEsc(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onEsc]);
}

/* -------------------------------------------------------------- bits */

export const cx = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(" ");

/** "GH₵" small + tabular number, for totals and tiles. */
export function Money({ v, className, cur = true }: { v: number; className?: string; cur?: boolean }) {
  return (
    <span className={cx("num", className)}>
      {cur && <small>GH₵</small>}{num(v)}
    </span>
  );
}

export function Badge({ tone = "ink", solid, outline, children, className }: { tone?: Tone; solid?: boolean; outline?: boolean; children: ReactNode; className?: string }) {
  return <span className={cx("badge", solid && "solid", outline && "outline", className)} data-tone={tone}>{children}</span>;
}

export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: Tone }> = {
  open: { label: "Open", tone: "sun" }, paid: { label: "Paid", tone: "forest" }, refunded: { label: "Refunded", tone: "terra" }, void: { label: "Void", tone: "ink" },
};
export const PO_STATUS: Record<POStatus, { label: string; tone: Tone }> = {
  draft: { label: "Draft", tone: "ink" }, sent: { label: "Sent", tone: "cobalt" }, received: { label: "Received (GRN)", tone: "sun" }, invoiced: { label: "Invoiced", tone: "forest" },
};

export function Stat({ tone = "sun", label, value, sub, onClick, white }: { tone?: Tone; label: string; value: ReactNode; sub?: ReactNode; onClick?: () => void; white?: boolean }) {
  const cls = cx("stat", white ? "on-white rounded-[20px]" : "block", onClick && "is-btn");
  const body = (
    <>
      <span className="stat-label">{label}</span>
      <span>
        <span className="stat-value block">{value}</span>
        {sub && <span className="stat-sub block mt-2">{sub}</span>}
      </span>
    </>
  );
  return onClick ? <button type="button" className={cls} data-tone={tone} onClick={onClick}>{body}</button> : <div className={cls} data-tone={tone}>{body}</div>;
}

export function Card({ title, actions, children, className, pad = true }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={cx("card", className)}>
      {(title || actions) && (
        <header className="card-head">
          <h3 className="card-title">{title}</h3>
          {actions}
        </header>
      )}
      <div className={pad ? "p-5" : ""}>{children}</div>
    </section>
  );
}

export function Field({ label, children, hint, className }: { label: string; children: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <label className={cx("field", className)}>
      <span>{label}</span>
      {children}
      {hint && <span className="text-[11.5px] font-medium">{hint}</span>}
    </label>
  );
}

export function Toggle({ on, onChange, sun, label }: { on: boolean; onChange: (v: boolean) => void; sun?: boolean; label?: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className={cx("switch", sun && "sun", on && "is-on")} onClick={() => onChange(!on)} />;
}

export function Seg<T extends string>({ options, value, onChange, onInk, className }: { options: { id: T; label: string; n?: number }[]; value: T; onChange: (v: T) => void; onInk?: boolean; className?: string }) {
  return (
    <div className={cx("seg", onInk && "on-ink", className)} role="tablist">
      {options.map((o) => (
        <button key={o.id} type="button" role="tab" aria-selected={o.id === value} className={cx("seg-btn", o.id === value && "is-active")} onClick={() => onChange(o.id)}>
          {o.label}{o.n !== undefined && <span className="n">{o.n}</span>}
        </button>
      ))}
    </div>
  );
}

export function Stepper({ value, onChange, min = 1, max = 99 }: { value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <span className="stepper">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} aria-label="Decrease">−</button>
      <b>{value}</b>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} aria-label="Increase">+</button>
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function Bar({ value, tone = "sun", className }: { value: number; tone?: Tone | CatKey; className?: string }) {
  return <span className={cx("bar block", className)} data-tone={tone}><i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></span>;
}

/* ------------------------------------------------------------- modal */

export function Modal({ title, sub, onClose, children, foot, size, tone }: { title: ReactNode; sub?: ReactNode; onClose: () => void; children: ReactNode; foot?: ReactNode; size?: "w" | "xw"; tone?: Tone }) {
  useEsc(onClose);
  return (
    <div className="modal-bg" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={cx("modal", size)} role="dialog" aria-modal="true" data-tone={tone}>
        <header className="modal-head">
          <div>
            <h2 className="modal-title">{title}</h2>
            {sub && <p className="modal-sub">{sub}</p>}
          </div>
          <button type="button" className="modal-x grid place-items-center" onClick={onClose} aria-label="Close"><X size={18} strokeWidth={2.5} /></button>
        </header>
        <div className="modal-body">{children}</div>
        {foot && <footer className="modal-foot">{foot}</footer>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ keypad */

export function Keypad({ onKey, alt = ".", className }: { onKey: (k: string) => void; alt?: string; className?: string }) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", alt, "0", "⌫"];
  return (
    <div className={cx("keys", className)}>
      {keys.map((k) => (
        <button key={k} type="button" className={cx(k === alt || k === "⌫" ? "alt" : "")} onClick={() => onKey(k)} aria-label={k === "⌫" ? "Backspace" : k}>{k}</button>
      ))}
    </div>
  );
}

/** Four-dot PIN entry with keypad; calls onDone with the 4 digits. */
export function PinPad({ onDone, error, length = 4, autoFocusKeys = true }: { onDone: (pin: string) => void; error?: boolean; length?: number; autoFocusKeys?: boolean }) {
  const [pin, setPin] = useState("");
  useEffect(() => { if (error) setPin(""); }, [error]);
  const key = (k: string) => {
    if (k === "⌫") return setPin((p) => p.slice(0, -1));
    if (k === "C") return setPin("");
    setPin((p) => {
      if (p.length >= length) return p;
      const n = p + k;
      if (n.length === length) setTimeout(() => onDone(n), 80);
      return n;
    });
  };
  useEffect(() => {
    if (!autoFocusKeys) return;
    const h = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) key(e.key);
      else if (e.key === "Backspace") key("⌫");
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocusKeys, length]);
  return (
    <div className="flex flex-col gap-5">
      <div className={cx("pinbox", error && "err")}>
        {Array.from({ length }).map((_, i) => <i key={i} className={i < pin.length ? "on" : ""} />)}
      </div>
      <Keypad onKey={key} alt="C" />
    </div>
  );
}

/** Amount entry in cedis on a keypad: "2","0","0" → GH₵ 200.00; "." starts the pesewas. */
export function useAmountKeys(initial = 0) {
  const [str, setStr] = useState(initial ? num(initial).replace(/,/g, "") : "");
  const value = str ? Math.round(Number.parseFloat(str) * 100) || 0 : 0;
  const key = (k: string) => {
    if (k === "⌫") return setStr((d) => d.slice(0, -1));
    if (k === "C") return setStr("");
    setStr((d) => {
      if (k === ".") return d.includes(".") ? d : (d || "0") + ".";
      const [, dec] = d.split(".");
      if (dec !== undefined && dec.length >= 2) return d;
      const n = (d + k).replace(/^0+(?=\d)/, "");
      return n.length > 10 ? d : n;
    });
  };
  const set = (pesewas: number) => setStr(pesewas ? num(pesewas).replace(/,/g, "") : "");
  return { value, str, key, set, clear: () => setStr("") };
}

export function Avatar({ initials, tone, size }: { initials: string; tone: Tone; size?: "lg" | "xl" }) {
  return <span className={cx("avatar", size)} data-tone={tone}>{initials}</span>;
}
