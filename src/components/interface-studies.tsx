"use client";

/**
 * Interface studies adapted for Lush View POS.
 *
 * These are original, dependency-free re-implementations of interaction
 * patterns studied from public interface galleries. They are deliberately
 * constrained for a working till:
 *  - money, totals and order numbers are never scrambled or hidden;
 *  - every animation honours `prefers-reduced-motion`;
 *  - hold-to-confirm is an addition to destructive actions, never a
 *    replacement for the normal Cancel path;
 *  - receipt/ticket motion describes the real print flow, it does not fake
 *    a printer the browser cannot see.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type DragEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { UploadCloud } from "lucide-react";

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return reduced;
}

/* ------------------------------------------------------------------ */
/* Scroll-fade list                                                    */
/* ------------------------------------------------------------------ */

type ScrollFadeListProps = {
  children: ReactNode;
  className?: string;
  fadeSize?: number;
  "aria-label"?: string;
};

/**
 * A vertical scroll region whose top/bottom edges fade only when there is
 * actually more content in that direction. Purely presentational: content,
 * order and accessibility are unchanged.
 */
export function ScrollFadeList({
  children,
  className = "",
  fadeSize = 28,
  ...rest
}: ScrollFadeListProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [mask, setMask] = useState<string>("none");

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const canUp = el.scrollTop > 2;
    const canDown = el.scrollTop + el.clientHeight < el.scrollHeight - 2;
    if (!canUp && !canDown) {
      setMask("none");
      return;
    }
    const top = canUp ? fadeSize : 0;
    const bottom = canDown ? fadeSize : 0;
    setMask(
      `linear-gradient(to bottom, transparent 0, black ${top}px, black calc(100% - ${bottom}px), transparent 100%)`,
    );
  }, [fadeSize]);

  useEffect(() => {
    update();
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(update);
    observer.observe(el);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [update]);

  const style: CSSProperties = mask === "none" ? {} : { maskImage: mask, WebkitMaskImage: mask };

  return (
    <div
      ref={ref}
      onScroll={update}
      className={className}
      style={style}
      {...rest}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Dynamic (measured) button                                           */
/* ------------------------------------------------------------------ */

type DynamicButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  busy?: boolean;
  busyLabel?: string;
  icon?: ReactNode;
  busyIcon?: ReactNode;
  /** Full-width buttons keep their layout width; only the label swaps. */
  fullWidth?: boolean;
};

/**
 * Primary action button whose width eases between its idle and busy labels
 * by measuring the incoming label before swapping it. The label itself is
 * always real text (never scrambled), and reduced-motion users get an
 * instant swap.
 */
export function DynamicButton({
  busy = false,
  busyLabel,
  icon,
  busyIcon,
  fullWidth = false,
  children,
  className = "",
  disabled,
  ...rest
}: DynamicButtonProps) {
  const reduced = usePrefersReducedMotion();
  const measureRef = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState<number | null>(null);
  const showingBusy = busy && !!busyLabel;

  useEffect(() => {
    const el = measureRef.current;
    if (el) setWidth(el.scrollWidth);
  }, [showingBusy, children, busyLabel]);

  return (
    <button
      disabled={disabled || busy}
      className={`relative overflow-hidden ${className}`}
      style={width && !reduced && !fullWidth ? { width } : undefined}
      {...rest}
    >
      {/* Hidden measurer for the label that is about to appear. */}
      <span
        ref={measureRef}
        aria-hidden="true"
        className="absolute invisible whitespace-nowrap flex items-center gap-2 px-1"
      >
        {showingBusy ? busyIcon : icon}
        <span>{showingBusy ? busyLabel : children}</span>
      </span>
      <span
        className={`flex items-center justify-center gap-2 whitespace-nowrap ${
          reduced ? "" : "transition-opacity duration-150"
        }`}
        aria-live="polite"
      >
        {showingBusy ? busyIcon : icon}
        <span>{showingBusy ? busyLabel : children}</span>
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Tactile button                                                      */
/* ------------------------------------------------------------------ */

type TactileButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  toneClass?: string;
};

/**
 * A chunky, physically "pressable" button: a raised face on a darker edge
 * that compresses when pressed. Colour still comes from the caller so the
 * till's existing meaning (amber = money action, emerald = confirm) is kept.
 */
export function TactileButton({
  toneClass = "",
  className = "",
  children,
  ...rest
}: TactileButtonProps) {
  return (
    <button
      className={`tactile-btn ${toneClass} ${className}`}
      {...rest}
    >
      <span className="tactile-btn-face">{children}</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Hold-to-confirm                                                     */
/* ------------------------------------------------------------------ */

type HoldToConfirmButtonProps = {
  label: string;
  holdingLabel?: string;
  durationMs?: number;
  disabled?: boolean;
  className?: string;
  onConfirm: () => void;
};

/**
 * Press-and-hold confirmation for irreversible actions. Holding fills the
 * button; releasing early cancels. Keyboard users hold Space/Enter.
 * It never auto-fires and never fires from a plain click.
 */
export function HoldToConfirmButton({
  label,
  holdingLabel = "Keep holding…",
  durationMs = 1400,
  disabled = false,
  className = "",
  onConfirm,
}: HoldToConfirmButtonProps) {
  const [progress, setProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  const frameRef = useRef<number | null>(null);
  const startRef = useRef(0);
  const firedRef = useRef(false);

  const stop = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    setHolding(false);
    if (!firedRef.current) setProgress(0);
  }, []);

  useEffect(
    () => () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  const begin = () => {
    if (disabled) return;
    firedRef.current = false;
    // Reduced-motion users still hold for the same duration; the fill is
    // rendered without transition smoothing, so the requirement is equal.
    startRef.current = performance.now();
    setHolding(true);
    const step = () => {
      const elapsed = performance.now() - startRef.current;
      const next = Math.min(1, elapsed / durationMs);
      setProgress(next);
      if (next >= 1) {
        if (!firedRef.current) {
          firedRef.current = true;
          onConfirm();
        }
        stop();
        return;
      }
      frameRef.current = requestAnimationFrame(step);
    };
    frameRef.current = requestAnimationFrame(step);
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={begin}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onKeyDown={(e) => {
        if ((e.key === " " || e.key === "Enter") && !e.repeat) begin();
      }}
      onKeyUp={(e) => {
        if (e.key === " " || e.key === "Enter") stop();
      }}
      onContextMenu={(e) => e.preventDefault()}
      className={`relative overflow-hidden select-none touch-none ${className}`}
      aria-label={`${label}. Press and hold to confirm.`}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 bg-white/25"
        style={{ width: `${progress * 100}%` }}
      />
      <span className="relative">{holding || progress > 0 ? holdingLabel : label}</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Scramble / decode text — branding only                              */
/* ------------------------------------------------------------------ */

const SCRAMBLE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&";

/**
 * Decode-reveal for non-critical branding text only. Never use this for
 * money, order numbers, names or anything staff must read accurately —
 * reduced-motion users (and anyone who needs certainty) get plain text.
 */
export function ScrambleText({
  text,
  className = "",
  speedMs = 28,
}: {
  text: string;
  className?: string;
  speedMs?: number;
}) {
  const reduced = usePrefersReducedMotion();
  const [display, setDisplay] = useState(text);

  useEffect(() => {
    if (reduced) return;
    let frame = 0;
    const total = Math.max(6, text.length + 4);
    const id = window.setInterval(() => {
      frame += 1;
      const settled = Math.floor((frame / total) * text.length);
      const next = text
        .split("")
        .map((ch, i) => {
          if (ch === " " || i < settled) return ch;
          return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
        })
        .join("");
      setDisplay(next);
      if (frame >= total) {
        setDisplay(text);
        window.clearInterval(id);
      }
    }, speedMs);
    return () => window.clearInterval(id);
  }, [text, reduced, speedMs]);

  return (
    <span className={className} aria-label={text}>
      <span aria-hidden="true">{reduced ? text : display}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Logo trace + signature (loading / signed-in identity)               */
/* ------------------------------------------------------------------ */

/** Circular trace used while the terminal is signing in. */
export function LogoTraceLoader({ label = "Signing in…" }: { label?: string }) {
  const reduced = usePrefersReducedMotion();
  return (
    <span className="inline-flex items-center gap-2" role="status" aria-label={label}>
      <svg width="18" height="18" viewBox="0 0 36 36" aria-hidden="true" className="shrink-0">
        <circle
          cx="18"
          cy="18"
          r="15"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.25"
          strokeWidth="3"
        />
        <circle
          cx="18"
          cy="18"
          r="15"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="94"
          strokeDashoffset="28"
          className={reduced ? "" : "logo-trace-spin"}
          style={{ transformOrigin: "center" }}
        />
      </svg>
      <span>{label}</span>
    </span>
  );
}

/**
 * "Signed in as" signature line: the person's own name, revealed with a
 * handwriting-style sweep. Falls back to static italic text for
 * reduced-motion users. Presentation only — the name is unchanged.
 */
export function AnimatedSignature({
  name,
  className = "",
}: {
  name: string;
  className?: string;
}) {
  const reduced = usePrefersReducedMotion();
  return (
    <span
      className={`inline-block italic font-semibold ${reduced ? "" : "signature-reveal"} ${className}`}
      aria-label={name}
    >
      {name}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Stamp                                                               */
/* ------------------------------------------------------------------ */

/** Rubber-stamp style status mark. Screen decoration; never printed. */
export function StampBadge({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block px-2 py-0.5 border-[3px] rounded-md font-black tracking-[0.18em] uppercase text-[0.65rem] -rotate-6 opacity-80 ${className}`}
    >
      {text}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Cassette-style sync indicator                                       */
/* ------------------------------------------------------------------ */

/**
 * Two-reel "tape" indicator for the offline queue: the reels turn while a
 * sync is actually running and sit still otherwise, so motion always means
 * "work is happening right now".
 */
export function CassetteSyncIndicator({ spinning }: { spinning: boolean }) {
  const reduced = usePrefersReducedMotion();
  const reel = (delay: string) => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={spinning && !reduced ? "cassette-reel" : ""}
      style={{ animationDelay: delay }}
    >
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M12 3v6M12 15v6M3 12h6M15 12h6" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </svg>
  );
  return (
    <span className="inline-flex items-center gap-1" aria-hidden="true">
      {reel("0s")}
      <span className="w-3 border-t border-current opacity-60" />
      {reel("0.35s")}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Fanned ticket stack (occupied tables)                               */
/* ------------------------------------------------------------------ */

/**
 * A small fanned stack of "tickets" peeking from behind a card. Used on
 * occupied tables to suggest open tickets without adding text staff must
 * read. Pure decoration (aria-hidden).
 */
export function FannedTicketStack({ count = 2 }: { count?: number }) {
  const layers = Math.max(1, Math.min(3, count));
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-x-6 -top-1.5 h-4">
      {Array.from({ length: layers }).map((_, i) => (
        <span
          key={i}
          className="absolute left-1/2 top-0 h-3.5 w-16 -translate-x-1/2 rounded-t-md bg-neutral-100/90 shadow-sm"
          style={{ transform: `translateX(-50%) rotate(${(i - (layers - 1) / 2) * 7}deg) translateY(${i * 1.5}px)` }}
        />
      ))}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Ticket perforation + stub                                           */
/* ------------------------------------------------------------------ */

/**
 * Perforated tear line with a stub that repeats the essentials. On the
 * kitchen docket the stub prints too (it is real, useful content: order
 * number, item count, time) — the serration itself is screen styling.
 */
export function TicketPerforation({ children }: { children?: ReactNode }) {
  return (
    <div aria-hidden={children ? undefined : true}>
      <div className="ticket-tear" />
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Magnetic drop zone (validated file drop)                            */
/* ------------------------------------------------------------------ */

type MagneticDropZoneProps = {
  onFile: (file: File) => void;
  accept?: string;
  label?: string;
  hint?: string;
  invalidMessage?: string;
};

/**
 * Drag-and-drop file zone. The zone leans a few pixels toward the cursor
 * while a file is dragged over it (desktop nicety; touch and keyboard
 * users use the normal file picker). Files are type-checked before the
 * caller ever sees them.
 */
export function MagneticDropZone({
  onFile,
  accept = "image/*",
  label = "Drop a photo here",
  hint = "or tap to choose a file",
  invalidMessage = "That file type is not supported here.",
}: MagneticDropZoneProps) {
  const reduced = usePrefersReducedMotion();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const accepts = (file: File) => {
    if (accept === "image/*") return file.type.startsWith("image/");
    return accept
      .split(",")
      .map((part) => part.trim())
      .some((part) => {
        if (part.endsWith("/*")) return file.type.startsWith(part.slice(0, -1));
        if (part.startsWith(".")) return file.name.toLowerCase().endsWith(part.toLowerCase());
        return file.type === part;
      });
  };

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!accepts(file)) {
      setError(invalidMessage);
      return;
    }
    setError("");
    onFile(file);
  };

  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(true);
    if (reduced) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 10;
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * 8;
    setOffset({ x, y });
  };

  const resetDrag = () => {
    setDragging(false);
    setOffset({ x: 0, y: 0 });
  };

  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (reduced || dragging) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 4;
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * 3;
    setOffset({ x, y });
  };

  return (
    <div>
      <div
        onDragOver={onDragOver}
        onDragLeave={resetDrag}
        onDrop={(event) => {
          event.preventDefault();
          resetDrag();
          handleFiles(event.dataTransfer.files);
        }}
        style={
          reduced
            ? undefined
            : { transform: `translate(${offset.x}px, ${offset.y}px)` }
        }
        className={`rounded-xl border-2 border-dashed transition-colors ${
          dragging
            ? "border-amber-400 bg-amber-500/10"
            : "border-neutral-700 bg-neutral-900/60"
        }`}
      >
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onPointerMove={onPointerMove}
          onPointerLeave={() => !dragging && setOffset({ x: 0, y: 0 })}
          className="w-full px-4 py-5 flex flex-col items-center gap-1.5 text-center"
          aria-label={`${label}. ${hint}`}
        >
          <UploadCloud className={`w-6 h-6 ${dragging ? "text-amber-300" : "text-neutral-400"}`} />
          <span className="text-xs font-semibold text-neutral-200">{label}</span>
          <span className="text-[0.6875rem] text-neutral-500">{hint}</span>
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(event) => {
          handleFiles(event.target.files);
          event.target.value = "";
        }}
      />
      {error && (
        <p role="alert" className="mt-1.5 text-[0.6875rem] font-semibold text-rose-400">
          {error}
        </p>
      )}
    </div>
  );
}
