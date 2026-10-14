"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

type Props = { className?: string; mint?: string; amber?: string };

/**
 * Particle constellation (React Bits "Particles"): drifting points, lines between
 * neighbours, gentle repulsion from the pointer. One rAF loop, DPR-aware,
 * pauses when the tab is hidden, draws a single static frame under
 * prefers-reduced-motion.
 */
export function Particles({ className = "", mint = "110,231,183", amber = "251,191,36" }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const host = cv.parentElement ?? cv;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const LINK = 130;
    type P = { x: number; y: number; vx: number; vy: number; r: number; hue: string };
    let W = 0, H = 0, pts: P[] = [], raf = 0, running = !document.hidden;
    const mouse = { x: -1e4, y: -1e4 };

    const resize = () => {
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = W * dpr; cv.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.max(40, Math.min(110, Math.round((W * H) / 14000)));
      pts = Array.from({ length: count }, () => ({
        x: Math.random() * W, y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35,
        r: Math.random() * 1.6 + 0.6, hue: Math.random() < 0.2 ? amber : mint,
      }));
    };
    const frame = () => {
      ctx.clearRect(0, 0, W, H);
      for (const p of pts) {
        if (!reduce) {
          const dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy;
          if (d2 < 120 * 120) { const d = Math.sqrt(d2) || 1, f = ((120 - d) / 120) * 0.6; p.vx += (dx / d) * f; p.vy += (dy / d) * f; }
          p.vx *= 0.985; p.vy *= 0.985; p.x += p.vx; p.y += p.vy;
          if (p.x < -10) p.x = W + 10; else if (p.x > W + 10) p.x = -10;
          if (p.y < -10) p.y = H + 10; else if (p.y > H + 10) p.y = -10;
        }
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fillStyle = `rgba(${p.hue},.9)`; ctx.fill();
      }
      ctx.lineWidth = 1;
      for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
        const a = pts[i], b = pts[j], dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
        if (d2 < LINK * LINK) {
          ctx.strokeStyle = `rgba(${mint},${((1 - Math.sqrt(d2) / LINK) * 0.35).toFixed(3)})`;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
      if (!reduce && running) raf = requestAnimationFrame(frame);
    };
    const onMove = (e: PointerEvent) => { const r = cv.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; };
    const onLeave = () => { mouse.x = mouse.y = -1e4; };
    const onVis = () => { running = !document.hidden; if (running && !reduce) { cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); } };
    const onResize = () => { resize(); if (reduce) frame(); };

    resize(); frame();
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVis);
    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVis);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
    };
  }, [reduce, mint, amber]);

  return <canvas ref={ref} className={`absolute inset-0 h-full w-full ${className}`} aria-hidden="true" />;
}
