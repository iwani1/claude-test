import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  reverse?: boolean;
  /** Tailwind classes for the moving track (speed comes from the animate-* class). */
  className?: string;
  trackClassName?: string;
  pauseOnHover?: boolean;
};

/**
 * CSS-only marquee. Children are rendered twice so `translateX(-50%)` loops
 * seamlessly; give each child its own right margin rather than using `gap`.
 */
export function Marquee({ children, reverse, className = "", trackClassName = "", pauseOnHover = true }: Props) {
  return (
    <div className={`mask-x overflow-hidden ${pauseOnHover ? "[&:hover>div]:[animation-play-state:paused]" : ""} ${className}`} aria-hidden="true">
      <div className={`flex w-max ${reverse ? "animate-marquee-rev" : "animate-marquee"} ${trackClassName}`}>
        {children}
        {children}
      </div>
    </div>
  );
}
