"use client";

import { animate, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

type Props = { to: number; duration?: number; delay?: number; className?: string; decimals?: number };

/** Counts from 0 to `to` with an ease-out curve the first time it is seen. */
export function NumberTicker({ to, duration = 1.8, delay = 0.6, className = "", decimals = 0 }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const reduce = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fmt = (n: number) => n.toLocaleString("en-GH", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    if (reduce || !inView) {
      if (reduce) el.textContent = fmt(to);
      return;
    }
    const controls = animate(0, to, {
      duration,
      delay,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        el.textContent = fmt(v);
      },
    });
    return () => controls.stop();
  }, [inView, reduce, to, duration, delay, decimals]);

  return (
    <span ref={ref} className={`tabular ${className}`}>
      0
    </span>
  );
}
