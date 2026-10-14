"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useId, useState, type ReactNode } from "react";

type Item = { readonly q: string; readonly a: string };

type Props = {
  items: readonly Item[];
  /** Styling hooks so each theme can own the look. */
  itemClassName?: string;
  buttonClassName?: string;
  panelClassName?: string;
  /** Renders the open/closed indicator; receives `open`. */
  indicator?: (open: boolean) => ReactNode;
  defaultOpen?: number | null;
};

/** Accessible accordion: one open item, animated height, proper aria wiring. */
export function Faq({ items, itemClassName = "", buttonClassName = "", panelClassName = "", indicator, defaultOpen = 0 }: Props) {
  const [open, setOpen] = useState<number | null>(defaultOpen);
  const base = useId();
  const reduce = useReducedMotion();
  return (
    <div>
      {items.map((it, i) => {
        const isOpen = open === i;
        const panelId = `${base}-p${i}`;
        const btnId = `${base}-b${i}`;
        return (
          <div key={it.q} className={itemClassName}>
            <h3 className="m-0">
              <button
                id={btnId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpen(isOpen ? null : i)}
                className={`flex w-full items-center justify-between gap-6 text-left ${buttonClassName}`}
              >
                <span>{it.q}</span>
                {indicator ? indicator(isOpen) : <span aria-hidden="true">{isOpen ? "−" : "+"}</span>}
              </button>
            </h3>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  id={panelId}
                  role="region"
                  aria-labelledby={btnId}
                  initial={reduce ? false : { height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={reduce ? undefined : { height: 0, opacity: 0 }}
                  transition={{ duration: 0.35, ease: [0.2, 0.7, 0.2, 1] }}
                  className="overflow-hidden"
                >
                  <p className={panelClassName}>{it.a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
