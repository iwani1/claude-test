"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { useDemo } from "./store";

/* Orbs design tokens for the demo app. */
export const T = {
  line: "border-emerald-50/10",
  glass: "border border-emerald-50/10 bg-white/[.04] backdrop-blur-md",
  glassStrong: "border border-emerald-50/10 bg-[rgba(2,12,10,.7)] backdrop-blur-xl",
  muted: "text-[#8fb3a6]",
  mint: "text-emerald-300",
  amber: "text-amber-300",
};

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl ${T.glass} ${className}`}>{children}</div>;
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "mint" | "amber" | "ghost" | "danger" | "ink"; size?: "sm" | "md" | "lg" };
export function Btn({ tone = "ghost", size = "md", className = "", ...rest }: BtnProps) {
  const tones = {
    mint: "bg-emerald-400 text-emerald-950 hover:bg-emerald-300 shadow-[0_8px_24px_-10px_rgba(52,211,153,.8)] disabled:shadow-none",
    amber: "bg-amber-400 text-amber-950 hover:bg-amber-300",
    ghost: `border ${T.line} bg-white/5 text-emerald-50 hover:bg-white/10`,
    danger: "border border-rose-400/30 bg-rose-400/10 text-rose-200 hover:bg-rose-400/20",
    ink: "bg-emerald-50 text-emerald-950 hover:bg-white",
  }[tone];
  const sizes = { sm: "px-3 py-1.5 text-xs rounded-lg", md: "px-4 py-2.5 text-sm rounded-xl", lg: "px-5 py-3.5 text-base rounded-xl" }[size];
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 font-semibold transition-all active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40 ${tones} ${sizes} ${className}`}
      {...rest}
    />
  );
}

export function Chip({ children, tone = "mint", className = "" }: { children: ReactNode; tone?: "mint" | "amber" | "rose" | "sky" | "muted"; className?: string }) {
  const tones = {
    mint: "border-emerald-400/30 bg-emerald-400/15 text-emerald-200",
    amber: "border-amber-400/30 bg-amber-400/15 text-amber-200",
    rose: "border-rose-400/30 bg-rose-400/15 text-rose-200",
    sky: "border-sky-400/30 bg-sky-400/15 text-sky-200",
    muted: "border-emerald-50/10 bg-white/5 text-[#8fb3a6]",
  }[tone];
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[.7rem] font-bold uppercase tracking-wider ${tones} ${className}`}>{children}</span>;
}

export function Modal({ open, onClose, title, children, width = "max-w-md" }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; width?: string }) {
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
          className="fixed inset-0 z-[60] grid place-items-end overflow-y-auto bg-black/60 p-0 backdrop-blur-sm sm:place-items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            className={`w-full ${width} max-h-[92dvh] overflow-y-auto rounded-t-3xl border border-emerald-50/10 bg-[#06160f] p-5 shadow-2xl sm:rounded-3xl`}
            initial={reduce ? false : { y: 24, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={reduce ? undefined : { y: 24, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
              <button type="button" onClick={onClose} aria-label="Close" className={`grid h-8 w-8 place-items-center rounded-lg border ${T.line} ${T.muted} hover:text-white`}>
                <X size={16} />
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
    <div className="pointer-events-none fixed inset-x-0 top-28 z-[70] md:top-16 flex flex-col items-center gap-2 px-4" aria-live="polite">
      <AnimatePresence>
        {state.toasts.map((t) => (
          <motion.button
            key={t.id}
            type="button"
            onClick={() => dispatch({ type: "dismissToast", id: t.id })}
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8 }}
            className={`pointer-events-auto rounded-full border px-4 py-2 text-sm font-medium shadow-xl backdrop-blur-xl ${
              t.tone === "ok" ? "border-emerald-400/30 bg-emerald-950/80 text-emerald-100" : t.tone === "warn" ? "border-amber-400/30 bg-amber-950/80 text-amber-100" : "border-emerald-50/10 bg-[rgba(2,12,10,.85)] text-emerald-50"
            }`}
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
      <span className={`mb-1.5 block text-xs font-semibold uppercase tracking-wider ${T.muted}`}>{label}</span>
      {children}
      {hint && <span className={`mt-1 block text-xs ${T.muted}`}>{hint}</span>}
    </label>
  );
}

export const inputCls = `w-full rounded-xl border ${T.line} bg-black/30 px-3.5 py-2.5 text-emerald-50 outline-none placeholder:text-emerald-50/30 focus:border-emerald-400/50 focus:ring-2 focus:ring-emerald-400/20`;

export const timeOf = (ms: number) => new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
export const minsSince = (ms: number, now: number) => Math.max(0, Math.floor((now - ms) / 60_000));
