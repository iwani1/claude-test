"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

type Segment = { text: string; className?: string };

type Props = {
  /** Segments let part of the line carry a different style (e.g. italic serif). */
  segments: Segment[];
  /** "rise" clips each word and slides it up (React Bits SplitText); "blur" fades words in from a blur (Magic UI BlurIn). */
  mode?: "rise" | "blur";
  stagger?: number;
  delay?: number;
  as?: "h1" | "h2" | "p";
  className?: string;
};

/** Word-by-word headline entrance. Words stay real text (selectable, readable by screen readers). */
export function SplitText({ segments, mode = "rise", stagger = 0.07, delay = 0.1, as = "h1", className = "" }: Props) {
  const reduce = useReducedMotion();
  const Tag = motion[as];
  let i = 0;
  const words: ReactNode[] = [];
  segments.forEach((seg, s) => {
    seg.text.split(/(\s+)/).forEach((part, k) => {
      if (!part) return;
      if (/^\s+$/.test(part)) {
        words.push(" ");
        return;
      }
      const d = delay + i++ * stagger;
      if (mode === "rise") {
        words.push(
          <span key={`${s}-${k}`} className={`inline-block overflow-hidden align-bottom px-[.02em] pt-[.05em] pb-[.18em] -mx-[.02em] -mt-[.05em] -mb-[.18em] ${seg.className ?? ""}`}>
            <motion.span
              className="inline-block"
              initial={reduce ? false : { y: "110%" }}
              animate={{ y: 0 }}
              transition={{ duration: 0.9, delay: d, ease: [0.2, 0.75, 0.2, 1] }}
            >
              {part}
            </motion.span>
          </span>,
        );
      } else {
        words.push(
          <motion.span
            key={`${s}-${k}`}
            className={`inline-block ${seg.className ?? ""}`}
            initial={reduce ? false : { opacity: 0, filter: "blur(10px)", y: 8 }}
            animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
            transition={{ duration: 0.9, delay: d, ease: [0.2, 0.7, 0.2, 1] }}
          >
            {part}
          </motion.span>,
        );
      }
    });
  });
  return <Tag className={className}>{words}</Tag>;
}
