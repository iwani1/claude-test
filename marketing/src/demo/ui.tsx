"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, type ReactNode } from "react";
import { useDemo } from "./store";

/* Everything reads the theme tokens declared in globals.css (.demo / [data-theme="day"]). */
export const K = {
  fg: "text-(--fg)",
  fg2: "text-(--fg2)",
  fg3: "text-(--fg3)",
  line: "border-(--line)",
  line2: "border-(--line2)",
  accent: "text-(--accent)",
  warn: "text-(--warn)",
  bad: "text-(--bad)",
};

export function Caps({ children, className = "", tone = "fg3" }: { children: ReactNode; className?: string; tone?: "fg3" | "fg2" | "accent" }) {
  return <span className={`text-[11px] font-semibold uppercase tracking-[.18em] ${tone === "accent" ? K.accent : tone === "fg2" ? K.fg2 : K.fg3} ${className}`}>{children}</span>;
}

export function Num({ children, className = "", italic = false }: { children: ReactNode; className?: string; italic?: boolean }) {
  return <span className={`font-serif lining ${italic ? "italic" : ""} ${className}`}>{children}</span>;
}

/** Money as the big serif numeral: GH₵ small, whole number, dimmed decimals. */
export function Money({ cents, size = "md", className = "", tone = "fg" }: { cents: number; size?: "sm" | "md" | "lg" | "xl"; className?: string; tone?: "fg" | "accent" | "fg2" }) {
  const neg = cents < 0;
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100).toLocaleString("en-GH");
  const dec = String(abs % 100).padStart(2, "0");
  // Four- and five-figure totals step down a size so the numeral never leaves its column.
  const wide = abs >= 100_000;
  const sizes = {
    sm: { n: "text-[18px]", c: "text-[11px] mr-1 align-[3px]" },
    md: { n: "text-[28px] leading-none", c: "text-xs mr-1.5 align-[8px]" },
    lg: { n: `${abs >= 1_000_000 ? "text-[40px]" : "text-[52px]"} leading-none tracking-[-.03em]`, c: "text-sm mr-2 align-[22px]" },
    xl: { n: `${wide ? "text-[clamp(52px,4.8vw,76px)]" : "text-[clamp(64px,6.4vw,100px)]"} leading-[.95] tracking-[-.04em] italic font-light`, c: "text-base mr-2 align-[.55em]" },
  }[size];
  const color = tone === "accent" ? K.accent : tone === "fg2" ? K.fg2 : K.fg;
  return (
    <span className={`font-serif lining whitespace-nowrap ${sizes.n} ${color} ${className}`}>
      <span className={`font-sans not-italic font-normal tracking-normal ${K.fg3} ${sizes.c}`}>{neg ? "−GH₵" : "GH₵"}</span>
      {whole}
      <span className={size === "xl" || size === "lg" ? "opacity-50" : K.fg2}>.{dec}</span>
    </span>
  );
}

type PillProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "accent" | "ghost"; right?: ReactNode; size?: "md" | "lg" };
export function Pill({ tone = "accent", right, size = "lg", className = "", children, ...rest }: PillProps) {
  const tones = tone === "accent" ? "bg-(--accent) text-(--accent-ink) hover:-translate-y-px shadow-[0_18px_40px_-24px_var(--accent)]" : `border ${K.line} ${K.fg} hover:border-(--fg3)`;
  const sizes = size === "lg" ? "h-14 px-7 text-[15px]" : "h-11 px-5 text-sm";
  return (
    <button
      type="button"
      className={`inline-flex w-full items-center justify-between gap-4 rounded-full font-semibold transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-30 disabled:shadow-none disabled:hover:translate-y-0 ${tones} ${sizes} ${className}`}
      {...rest}
    >
      <span>{children}</span>
      {right !== undefined && <span className="font-serif text-[17px] font-normal opacity-80">{right}</span>}
    </button>
  );
}

type LinkProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "accent" | "fg3" | "fg2"; arrow?: boolean };
export function TextLink({ tone = "accent", arrow = true, className = "", children, ...rest }: LinkProps) {
  const color = tone === "accent" ? K.accent : tone === "fg2" ? `${K.fg2} hover:text-(--fg)` : `${K.fg3} hover:text-(--fg)`;
  return (
    <button type="button" className={`inline-flex items-center gap-1.5 text-sm font-semibold underline-offset-4 transition-colors hover:underline disabled:cursor-not-allowed disabled:opacity-40 disabled:no-underline ${color} ${className}`} {...rest}>
      {children}
      {arrow && <span aria-hidden="true">→</span>}
    </button>
  );
}

/** A small text choice (category tab, method tab): small caps with an underline when active. */
export function Tab({ on, children, className = "", ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { on: boolean }) {
  return (
    <button
      type="button"
      className={`relative pb-2 text-[11px] font-semibold uppercase tracking-[.18em] transition-colors ${on ? K.fg : `${K.fg3} hover:text-(--fg2)`} ${className}`}
      {...rest}
    >
      {children}
      {on && <motion.span layoutId={rest.name ? `tab-${rest.name}` : undefined} className="absolute inset-x-0 -bottom-px h-px bg-(--fg)" />}
    </button>
  );
}

export function Modal({ open, onClose, title, kicker, children, width = "max-w-[460px]" }: { open: boolean; onClose: () => void; title: ReactNode; kicker?: ReactNode; children: ReactNode; width?: string }) {
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] grid place-items-end overflow-y-auto bg-(--scrim) p-0 backdrop-blur-[2px] sm:place-items-center sm:p-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            className={`w-full ${width} max-h-[92dvh] overflow-y-auto rounded-t-[22px] border ${K.line} bg-(--bg) px-8 pb-8 pt-7 text-(--fg) shadow-[0_40px_80px_-40px_rgba(0,0,0,.6)] sm:rounded-[22px]`}
            initial={reduce ? false : { y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduce ? undefined : { y: 16, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.2, 0.7, 0.2, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6 flex items-start justify-between gap-6">
              <div>
                {kicker && <Caps className="block">{kicker}</Caps>}
                <h2 className="mt-1 font-serif text-[28px] italic leading-none tracking-[-.01em]">{title}</h2>
              </div>
              <button type="button" onClick={onClose} className={`mt-1 text-sm ${K.fg3} hover:text-(--fg)`}>
                Close
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Toasts() {
  const { state, dispatch } = useDemo();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[70] flex flex-col items-center gap-2 px-4" aria-live="polite">
      <AnimatePresence>
        {state.toasts.map((t) => (
          <motion.button
            key={t.id}
            type="button"
            onClick={() => dispatch({ type: "dismissToast", id: t.id })}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className={`pointer-events-auto rounded-full border ${K.line} bg-(--bg) px-5 py-2.5 text-sm shadow-[0_20px_50px_-30px_rgba(0,0,0,.6)] ${t.tone === "warn" ? K.warn : K.fg}`}
          >
            {t.text}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <Caps className="block">{label}</Caps>
      {children}
      {hint && <span className={`mt-2 block text-xs ${K.fg3}`}>{hint}</span>}
    </label>
  );
}

/** Underline inputs: no box, a hairline that turns accent on focus. */
export const inputCls = `w-full border-0 border-b ${K.line} bg-transparent py-2.5 text-(--fg) outline-none transition-colors focus:border-(--accent)`;

export const timeOf = (ms: number) => new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
export const minsSince = (ms: number, now: number) => Math.max(0, Math.floor((now - ms) / 60_000));
