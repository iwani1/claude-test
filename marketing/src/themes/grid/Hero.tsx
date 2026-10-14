"use client";

import { ArrowRight, ChevronRight, Sparkles } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import { brand, cta, marqueeChips, nav } from "@/content/site";
import { Marquee } from "@/components/shared/Marquee";
import { NumberTicker } from "@/components/shared/NumberTicker";
import { Reveal } from "@/components/shared/Reveal";
import { SplitText } from "@/components/shared/SplitText";

const COLORS = ["#059669", "#2563eb", "#d97706", "#7c3aed", "#0891b2", "#db2777", "#059669", "#2563eb", "#dc2626", "#d97706", "#7c3aed", "#0891b2"];

/** Magic UI "AnimatedGridPattern": an SVG grid where random cells light up and fade. */
function AnimatedGrid() {
  const svg = useRef<SVGSVGElement>(null);
  const group = useRef<SVGGElement>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    const s = svg.current, g = group.current;
    if (!s || !g) return;
    const size = 40;
    const rects: SVGRectElement[] = [];
    const place = (r: SVGRectElement) => {
      const box = s.getBoundingClientRect();
      r.setAttribute("x", String(Math.floor(Math.random() * Math.ceil(box.width / size)) * size + 1));
      r.setAttribute("y", String(Math.floor(Math.random() * Math.ceil(box.height / size)) * size + 1));
    };
    for (let k = 0; k < 28; k++) {
      const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      r.setAttribute("width", String(size - 1));
      r.setAttribute("height", String(size - 1));
      r.setAttribute("fill", "#059669");
      r.style.opacity = "0";
      r.style.transition = reduce ? "none" : "opacity 1.4s ease";
      place(r);
      g.appendChild(r);
      rects.push(r);
    }
    if (reduce) {
      rects.slice(0, 10).forEach((r) => (r.style.opacity = ".18"));
      return () => rects.forEach((r) => r.remove());
    }
    const id = setInterval(() => {
      const r = rects[Math.floor(Math.random() * rects.length)];
      if (r.style.opacity !== "0") r.style.opacity = "0";
      else {
        place(r);
        r.style.opacity = ".18";
      }
    }, 180);
    return () => {
      clearInterval(id);
      rects.forEach((r) => r.remove());
    };
  }, [reduce]);
  return (
    <svg ref={svg} aria-hidden="true" className="absolute inset-0 -z-20 h-full w-full mask-radial-top">
      <defs>
        <pattern id="g40" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M40 0H0V40" fill="none" stroke="#e4e4e7" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#g40)" />
      <g ref={group} />
    </svg>
  );
}

export function GridHero() {
  return (
    <section className="relative isolate flex min-h-dvh flex-col overflow-hidden">
      <AnimatedGrid />
      <div aria-hidden="true" className="pointer-events-none absolute -top-[20vh] left-1/2 -z-10 h-[50vh] w-[70vw] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,.18),transparent_60%)] blur-[30px]" />

      <Reveal immediate className="mx-auto flex w-[min(1120px,100%-2.5rem)] items-center justify-between py-4" role="navigation" aria-label="Primary">
        <a href="#" className="inline-flex items-center gap-2.5 font-semibold tracking-tight">
          <img src={brand.logo} alt="" width={30} height={30} className="rounded-lg" /> {brand.name}
        </a>
        <div className="hidden gap-6 text-sm text-zinc-500 md:flex">
          {nav.map((n) => (
            <a key={n.href} href={n.href} className="hover:text-zinc-900">
              {n.label}
            </a>
          ))}
        </div>
        <a href="#pricing" className="rounded-[10px] border border-zinc-200 bg-white px-3.5 py-2 text-sm font-semibold shadow-sm hover:border-zinc-300">
          Sign in
        </a>
      </Reveal>

      <div className="mx-auto w-[min(880px,100%-2.5rem)] pb-10 pt-[clamp(2.5rem,8vh,5rem)] text-center">
        <Reveal immediate delay={0.05}>
          <a
            href="#features"
            className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-[.8rem] font-medium text-zinc-600 shadow-sm transition-colors hover:border-zinc-300"
          >
            <Sparkles size={14} className="text-amber-500" aria-hidden="true" />
            <span className="animate-shiny bg-[linear-gradient(110deg,#52525b_35%,#0a0a0a_50%,#52525b_65%)] bg-[length:250%_100%] bg-clip-text text-transparent">
              Introducing offline shifts — the till keeps selling when the network drops
            </span>
            <ChevronRight size={14} className="text-zinc-400" aria-hidden="true" />
          </a>
        </Reveal>
        <SplitText
          mode="blur"
          stagger={0.09}
          segments={[{ text: "Every order, every cedi," }, { text: " accounted for.", className: "text-emerald-600" }]}
          className="mb-4 mt-6 text-balance text-[clamp(2.5rem,6.4vw,4.6rem)] font-bold leading-[1.04] tracking-[-.04em]"
        />
        <Reveal immediate delay={0.55}>
          <p className="mx-auto max-w-[38rem] text-pretty text-[clamp(1.02rem,1.4vw,1.18rem)] leading-relaxed text-zinc-500">
            One point of sale for the restaurant, the bar and room service. Orders go to the kitchen screen, stock deducts itself from the recipe, and the
            shift reconciles to the cedi.
          </p>
        </Reveal>
        <Reveal immediate delay={0.65} className="mt-8 flex flex-wrap justify-center gap-3">
          <a
            href="#pricing"
            className="relative isolate inline-flex items-center gap-2 overflow-hidden rounded-[14px] bg-zinc-950 px-5.5 py-3.5 text-[.95rem] font-semibold text-white shadow-[0_10px_30px_-12px_rgba(0,0,0,.5)] transition-transform hover:-translate-y-px before:absolute before:-inset-[150%] before:-z-20 before:conic-sweep after:absolute after:inset-[1.5px] after:-z-10 after:rounded-[12.5px] after:bg-zinc-950"
          >
            {cta.primary} <ArrowRight size={16} aria-hidden="true" />
          </a>
          <a href="#how" className="inline-flex items-center rounded-[14px] border border-zinc-200 bg-white px-5 py-3.5 text-[.95rem] font-semibold transition-colors hover:border-zinc-300 hover:bg-zinc-50">
            Book a 20-minute demo
          </a>
        </Reveal>
        <Reveal immediate delay={0.75}>
          <p className="mt-4 text-[.8rem] text-zinc-500">{cta.micro}</p>
        </Reveal>
      </div>

      <Reveal immediate delay={0.8} className="mx-auto w-[min(1120px,100%)]">
        <Marquee trackClassName="py-1">
          {marqueeChips.slice(0, 6).map((c, i) => (
            <Chip key={c} label={c} color={COLORS[i]} />
          ))}
        </Marquee>
        <Marquee reverse className="mt-2" trackClassName="py-1">
          {marqueeChips.slice(6).map((c, i) => (
            <Chip key={c} label={c} color={COLORS[i + 6]} />
          ))}
        </Marquee>
      </Reveal>

      {/* bento */}
      <div className="mx-auto mb-16 mt-10 grid w-[min(1120px,100%-2.5rem)] gap-4 md:grid-cols-[1.2fr_1fr_1fr]">
        <Reveal immediate delay={0.9}>
          <Tile featured title="Live sales" sub="Today across the till, the bar and room service.">
            <div className="mb-0.5 mt-3.5 text-[clamp(2rem,3.4vw,2.6rem)] font-bold tracking-tight">
              GH₵ <NumberTicker to={4230} delay={0.9} />
              <small className="ml-1.5 text-[.95rem] font-semibold text-emerald-600">+12% vs last Tue</small>
            </div>
            <svg className="mt-2 h-16 w-full" viewBox="0 0 300 64" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#10b981" stopOpacity=".25" />
                  <stop offset="1" stopColor="#10b981" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0 50 C 30 48, 50 40, 80 42 S 130 30, 160 28 S 210 22, 240 14 S 280 10, 300 6 V64 H0 Z"
                fill="url(#fade)"
                className="animate-fadein opacity-0"
              />
              <path
                d="M0 50 C 30 48, 50 40, 80 42 S 130 30, 160 28 S 210 22, 240 14 S 280 10, 300 6"
                fill="none"
                stroke="#059669"
                strokeWidth="2"
                strokeLinecap="round"
                className="animate-draw [stroke-dasharray:600] [stroke-dashoffset:600]"
              />
            </svg>
          </Tile>
        </Reveal>
        <Reveal immediate delay={1}>
          <Tile title="Kitchen display" sub="Tickets fire the moment the order is sent.">
            <div className="mt-3.5 flex flex-col gap-2">
              {[
                ["T7 · Jollof & Chicken", "New", "bg-amber-100 text-amber-700"],
                ["T3 · Banku & Tilapia ×2", "Cooking · 6m", "bg-blue-100 text-blue-700"],
                ["Room 12 · Kelewele", "Ready", "bg-emerald-100 text-emerald-700"],
              ].map(([t, s, c]) => (
                <div key={t} className="flex items-center justify-between rounded-[10px] border border-zinc-200 bg-zinc-50 px-3 py-2 text-[.8rem] font-medium">
                  <span>{t}</span>
                  <b className={`rounded-full px-2 py-0.5 text-[.7rem] font-semibold ${c}`}>{s}</b>
                </div>
              ))}
            </div>
          </Tile>
        </Reveal>
        <Reveal immediate delay={1.1}>
          <Tile title="Stock that deducts itself" sub="Each sale takes the recipe out of ingredient stock.">
            <div className="mt-4 flex flex-col gap-3">
              {[
                ["Tilapia (whole)", "7 left", "18%", "bg-red-500"],
                ["Rice (kg)", "26 kg", "52%", "bg-amber-500"],
                ["Sobolo (bottles)", "43", "86%", "bg-emerald-600"],
              ].map(([n, v, w, c]) => (
                <div key={n} className="text-[.78rem] text-zinc-700">
                  <span className="tabular mb-1 flex justify-between">
                    <em className="not-italic">{n}</em>
                    <em className="not-italic">{v}</em>
                  </span>
                  <i className="block h-[7px] overflow-hidden rounded-full bg-zinc-100">
                    <motion.i
                      className={`block h-full rounded-full ${c}`}
                      initial={{ width: 0 }}
                      animate={{ width: w }}
                      transition={{ duration: 1.4, delay: 1.2, ease: [0.2, 0.7, 0.2, 1] }}
                    />
                  </i>
                </div>
              ))}
            </div>
          </Tile>
        </Reveal>
      </div>
    </section>
  );
}

function Chip({ label, color }: { label: string; color: string }) {
  return (
    <span className="mr-3 inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-zinc-200 bg-white px-3.5 py-2 text-[.82rem] font-medium text-zinc-700 shadow-sm">
      <i className="h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function Tile({ title, sub, featured, children }: { title: string; sub: string; featured?: boolean; children: React.ReactNode }) {
  return (
    <div
      className={`relative h-full overflow-hidden rounded-[20px] border border-zinc-200 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,.03),0_12px_30px_-24px_rgba(0,0,0,.25)] ${
        featured ? "border-beam" : ""
      }`}
    >
      <h3 className="text-[.95rem] font-semibold tracking-tight">{title}</h3>
      <p className="text-[.82rem] text-zinc-500">{sub}</p>
      {children}
    </div>
  );
}
