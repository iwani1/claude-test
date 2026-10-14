"use client";

import { ArrowRight, Check, Clock } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { useRef } from "react";
import { brand, cta, ghs, nav, order, trust } from "@/content/site";
import { Reveal } from "@/components/shared/Reveal";

const BEAMS = [
  { left: "12%", d: "9s", delay: "-2s", c: "#a78bfa" },
  { left: "31%", d: "12s", delay: "-7s", c: "#22d3ee" },
  { left: "58%", d: "8s", delay: "-4s", c: "#f0abfc" },
  { left: "83%", d: "11s", delay: "-1s", c: "#34d399" },
];

export function AuroraHero() {
  const hero = useRef<HTMLElement>(null);
  const spot = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const raf = useRef(0);

  const onMove = (e: React.PointerEvent) => {
    if (reduce || !hero.current || !spot.current) return;
    const r = hero.current.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      spot.current?.style.setProperty("--x", `${x}%`);
      spot.current?.style.setProperty("--y", `${y}%`);
    });
  };

  return (
    <section ref={hero} onPointerMove={onMove} className="relative isolate flex min-h-dvh flex-col overflow-hidden">
      {/* aurora */}
      <div aria-hidden="true" className="pointer-events-none absolute -inset-[20%] -z-40 opacity-75 blur-[70px] saturate-[1.3]">
        <span className="absolute -left-[10%] -top-[10%] h-[55vw] w-[55vw] animate-drift rounded-full mix-blend-screen [background:radial-gradient(circle_at_30%_30%,#7c3aed,transparent_60%)]" />
        <span className="absolute -right-[5%] top-[5%] h-[45vw] w-[45vw] animate-drift rounded-full mix-blend-screen [animation-delay:-8s] [animation-duration:31s] [background:radial-gradient(circle_at_60%_40%,#22d3ee,transparent_60%)]" />
        <span className="absolute -bottom-[25%] left-[25%] h-[50vw] w-[50vw] animate-drift rounded-full mix-blend-screen [animation-delay:-15s] [animation-duration:29s] [background:radial-gradient(circle,#e879f9,transparent_60%)]" />
        <span className="absolute bottom-0 right-[20%] h-[30vw] w-[30vw] animate-drift rounded-full opacity-55 mix-blend-screen [animation-delay:-4s] [animation-duration:35s] [background:radial-gradient(circle,#34d399,transparent_60%)]" />
      </div>
      {/* grid */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-30 grid-lines mask-radial" />
      {/* spotlight */}
      <div
        ref={spot}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-20 transition-[background] duration-100 [background:radial-gradient(640px_circle_at_var(--x,50%)_var(--y,30%),rgba(255,255,255,.085),transparent_45%)]"
      />
      {/* beams */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        {BEAMS.map((b) => (
          <i
            key={b.left}
            className="absolute -top-[20%] h-[140%] w-px [background:linear-gradient(to_bottom,transparent,rgba(255,255,255,.08),transparent)] after:absolute after:-left-px after:-top-40 after:h-40 after:w-[3px] after:animate-fall after:[animation-delay:var(--delay)] after:[animation-duration:var(--d)] after:[background:linear-gradient(to_bottom,transparent,var(--c),transparent)] after:[filter:drop-shadow(0_0_6px_var(--c))] after:content-['']"
            style={{ left: b.left, "--d": b.d, "--delay": b.delay, "--c": b.c } as React.CSSProperties}
          />
        ))}
      </div>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 [background:radial-gradient(ellipse_80%_80%_at_50%_50%,transparent_40%,rgba(5,1,15,.85)_100%)]" />

      {/* nav */}
      <Reveal immediate className="mx-auto flex w-[min(1180px,100%-2.5rem)] items-center justify-between gap-4 py-5" role="navigation" aria-label="Primary">
        <a href="#" className="inline-flex items-center gap-2.5 font-semibold tracking-tight">
          <img src={brand.logo} alt="" width={32} height={32} className="rounded-[9px] shadow-[0_0_0_1px_rgba(255,255,255,.08)]" />
          {brand.name}
        </a>
        <div className="hidden gap-7 text-[.925rem] text-zinc-400 md:flex">
          {nav.map((n) => (
            <a key={n.href} href={n.href} className="transition-colors hover:text-white">
              {n.label}
            </a>
          ))}
        </div>
        <a
          href="#pricing"
          className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold backdrop-blur transition-colors hover:border-white/30 hover:bg-white/10"
        >
          {cta.nav}
        </a>
      </Reveal>

      {/* content */}
      <div className="mx-auto grid w-[min(1180px,100%-2.5rem)] flex-1 items-center gap-12 py-10 pb-16 lg:grid-cols-[1.05fr_.95fr] lg:gap-14 lg:py-8 lg:pb-20">
        <div>
          <Reveal immediate delay={0.05}>
            <span className="inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-white/5 py-1.5 pl-2.5 pr-3.5 text-[.8rem] font-medium text-zinc-300 backdrop-blur">
              <span className="h-2 w-2 animate-pulse-dot rounded-full bg-emerald-400 shadow-[0_0_0_0_rgba(52,211,153,.6)]" />
              <b className="font-semibold text-white">New</b> · Offline mode covers the whole shift
            </span>
          </Reveal>
          <Reveal immediate delay={0.15}>
            <h1 className="mb-4 mt-6 text-balance text-[clamp(2.6rem,6.4vw,4.9rem)] font-bold leading-[1.02] tracking-[-.035em]">
              Run the whole floor from{" "}
              <span className="animate-shine bg-[linear-gradient(90deg,#c4b5fd_0%,#67e8f9_45%,#f0abfc_100%)] bg-[length:200%_100%] bg-clip-text text-transparent">
                one screen
              </span>
              .
            </h1>
          </Reveal>
          <Reveal immediate delay={0.25}>
            <p className="max-w-[34rem] text-pretty text-[clamp(1.05rem,1.4vw,1.2rem)] leading-relaxed text-zinc-400">
              {brand.name} takes the order at the table, fires it to the kitchen, and settles it in Cash or MoMo — with the stock and the VAT already
              worked out.
            </p>
          </Reveal>
          <Reveal immediate delay={0.35} className="mt-8 flex flex-wrap gap-3">
            <a
              href="#pricing"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3.5 text-[.95rem] font-semibold text-zinc-950 shadow-[0_0_0_1px_rgba(255,255,255,.08),0_12px_40px_-12px_rgba(124,58,237,.75)] transition-all hover:-translate-y-px hover:shadow-[0_0_0_1px_rgba(255,255,255,.12),0_18px_50px_-12px_rgba(34,211,238,.7)] active:translate-y-px"
            >
              {cta.primary}
            </a>
            <a
              href="#how"
              className="group inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[.03] px-5 py-3.5 text-[.95rem] font-semibold backdrop-blur transition-colors hover:border-white/30 hover:bg-white/10"
            >
              {cta.secondary}
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </a>
          </Reveal>
          <Reveal immediate delay={0.45} className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-[.85rem] text-zinc-300">
            {trust.map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5">
                <Check size={15} strokeWidth={2.5} className="text-emerald-400" aria-hidden="true" />
                {t}
              </span>
            ))}
          </Reveal>
        </div>

        {/* product mock-up */}
        <Reveal immediate delay={0.3} className="group relative [perspective:1400px]">
          <div
            role="img"
            aria-label="Mock-up of an open order on the till"
            className="relative mx-auto w-full max-w-[440px] animate-float rounded-[22px] border border-white/15 bg-[linear-gradient(160deg,rgba(255,255,255,.1),rgba(255,255,255,.03))] p-4 shadow-[0_30px_80px_-30px_rgba(0,0,0,.8),inset_0_1px_0_rgba(255,255,255,.15)] backdrop-blur-xl backdrop-saturate-150 transition-transform duration-700 ease-[cubic-bezier(.2,.8,.2,1)] [transform:rotateY(-10deg)_rotateX(5deg)] group-hover:[transform:rotateY(-3deg)_rotateX(1deg)]"
          >
            <div className="mb-3.5 flex items-center justify-between">
              <div className="text-[.95rem] font-semibold">
                {order.table}
                <small className="mt-0.5 block text-xs font-medium text-zinc-400">{order.meta}</small>
              </div>
              <span className="rounded-full border border-emerald-400/30 bg-emerald-400/15 px-2.5 py-1 text-[.7rem] font-semibold text-emerald-300">
                {order.status}
              </span>
            </div>
            {order.lines.map((l, i) => (
              <div key={l.name} className={`grid grid-cols-[44px_1fr_auto] items-center gap-3 py-2 ${i ? "border-t border-white/10" : ""}`}>
                <div className="h-11 w-11 overflow-hidden rounded-[10px] bg-[linear-gradient(135deg,#3b2a6b,#1e1b4b)] shadow-[inset_0_0_0_1px_rgba(255,255,255,.08)]">
                  <img src={l.img} alt="" width={44} height={44} className="h-full w-full object-cover" loading="eager" />
                </div>
                <div className="text-sm font-medium">
                  {l.name}
                  <small className="mt-0.5 block text-xs font-normal text-zinc-400">{l.note}</small>
                </div>
                <div className="tabular text-sm font-semibold">{ghs(l.price)}</div>
              </div>
            ))}
            <div className="mt-2 border-t border-dashed border-white/15 pt-3 text-xs text-zinc-400">
              <div className="tabular flex justify-between py-0.5">
                <span>Subtotal</span>
                <span>{ghs(order.subtotal)}</span>
              </div>
              <div className="tabular flex justify-between py-0.5">
                <span>VAT &amp; levies</span>
                <span>{ghs(order.tax)}</span>
              </div>
              <div className="tabular flex justify-between pt-2 text-base font-bold text-white">
                <span>Total</span>
                <span>{ghs(order.total)}</span>
              </div>
            </div>
            <button
              type="button"
              className="mt-3.5 w-full rounded-[14px] bg-[linear-gradient(90deg,#7c3aed,#4f46e5_50%,#0891b2)] bg-[length:200%_100%] py-3.5 font-bold text-white shadow-[0_10px_30px_-10px_rgba(124,58,237,.8),inset_0_1px_0_rgba(255,255,255,.2)] transition-all hover:-translate-y-px hover:bg-right"
            >
              Charge {ghs(order.total)} · {order.tender}
            </button>
          </div>
          <div className="absolute -left-2 -top-4 flex animate-float items-center gap-2.5 rounded-[14px] border border-white/15 bg-[rgba(10,6,24,.75)] px-3.5 py-2.5 text-xs font-semibold shadow-[0_20px_50px_-20px_rgba(0,0,0,.8)] backdrop-blur-xl [animation-delay:-2s] lg:-left-12 lg:top-6">
            <span className="grid h-[30px] w-[30px] place-items-center rounded-[9px] bg-amber-400/15 text-amber-400">
              <Clock size={16} aria-hidden="true" />
            </span>
            <div>
              Kitchen · 3 tickets open<small className="mt-px block text-[.7rem] font-medium text-zinc-400">Oldest 4 min</small>
            </div>
          </div>
          <div className="absolute -right-2.5 bottom-11 flex animate-float items-center gap-2.5 rounded-[14px] border border-white/15 bg-[rgba(10,6,24,.75)] px-3.5 py-2.5 text-xs font-semibold shadow-[0_20px_50px_-20px_rgba(0,0,0,.8)] backdrop-blur-xl [animation-delay:-4s] lg:-right-10 lg:bottom-16">
            <span className="grid h-[30px] w-[30px] place-items-center rounded-[9px] bg-emerald-400/15 text-emerald-400">
              <Check size={16} strokeWidth={2.5} aria-hidden="true" />
            </span>
            <div>
              MoMo received<small className="mt-px block text-[.7rem] font-medium text-zinc-400">{ghs(order.total)} · Table 7</small>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
