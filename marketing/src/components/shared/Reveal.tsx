"use client";

import { motion, useReducedMotion, type HTMLMotionProps } from "motion/react";
import type { ReactNode } from "react";

type Props = Omit<HTMLMotionProps<"div">, "children"> & {
  children: ReactNode;
  /** Seconds to wait before this block animates in. */
  delay?: number;
  /** Pixels to travel; use a negative value to slide in from the left. */
  y?: number;
  x?: number;
  /** Animate on mount instead of when scrolled into view. */
  immediate?: boolean;
};

/** Fade-and-rise entrance, once, when the block scrolls into view. */
export function Reveal({ children, delay = 0, y = 16, x = 0, immediate = false, ...rest }: Props) {
  const reduce = useReducedMotion();
  const hidden = reduce ? { opacity: 1 } : { opacity: 0, y, x };
  const shown = { opacity: 1, y: 0, x: 0 };
  return (
    <motion.div
      initial={hidden}
      {...(immediate ? { animate: shown } : { whileInView: shown, viewport: { once: true, margin: "-10% 0px" } })}
      transition={{ duration: 0.8, delay, ease: [0.2, 0.7, 0.2, 1] }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
