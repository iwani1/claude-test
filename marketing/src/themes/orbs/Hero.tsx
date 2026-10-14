"use client";

import { Play } from "lucide-react";
import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { brand, cta, nav, ticket } from "@/content/site";
import { Particles } from "@/components/shared/Particles";
import { Reveal } from "@/components/shared/Reveal";
import { SplitText } from "@/components/shared/SplitText";

/** React Bits "TiltedCard": rotates toward the pointer with a glare that follows it. */
function TiltTicket() {
  const reduce = useReducedMotion();
  const rx = useSpring(useMotionValue(0), { stiffness: 180, damping: 20 });
  const ry = useSpring(useMotionValue(0), { stiffness: 180, damping: 20 });
  const gx = useMotionValue(50);
  const gy = useMotionValue(50);
  const glare = useMotionTemplate`radial-gradient(500px circle at ${gx}% ${gy}%, rgba(255,255,255,.14), transparent 45%)`;

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reduce) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    ry.set((x - 0.5) * 16);
    rx.set((0.5 - y) * 14);
    gx.set(x * 100);
    gy.set(y * 100);
  };
  const onLeave = () => {
    rx.set(0);
    ry.set(0);
  };

  return (
    <div className="group relative mx-auto mt-12 w-full max-w-[420px] px-5 pb-16 [perspective:1200px]" onPointerMove={onMove} onPointerLeave={onLeave}>
      <div aria-hidden="true" className="absolute -top-[22px] left-1/2 h-[140px] w-[calc(100%-2.5rem)] -translate-x-1/2 scale-[.9] rounded-[18px] border border-emerald-50/10 bg-white/[.04] opacity-50 backdrop-blur-xl" />
      <div aria-hidden="true" className="absolute -top-[11px] left-1/2 h-[140px] w-[calc(100%-2.5rem)] -translate-x-1/2 scale-[.95] rounded-[18px] border border-emerald-50/10 bg-white/[.06] opacity-70 backdrop-blur-xl" />
      <motion.div
        role="img"
        aria-label="Mock-up of a kitchen display ticket"
        style={{ rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" }}
        className="relative z-10 rounded-[18px] border border-emerald-50/10 bg-[linear-gradient(160deg,rgba(255,255,255,.09),rgba(255,255,255,.03))] p-4.5 shadow-[0_30px_70px_-30px_rgba(0,0,0,.9),inset_0_1px_0_rgba(255,255,255,.12)] backdrop-blur-xl"
      >
        <motion.div aria-hidden="true" style={{ background: glare }} className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        <div className="mb-3 flex items-center justify-between">
          <div>
            <b className="text-base font-semibold">{ticket.table}</b>
            <small className="mt-0.5 block text-xs font-medium text-[#8fb3a6]">{ticket.meta}</small>
          </div>
          <span className="rounded-full border border-amber-400/30 bg-amber-400/15 px-2.5 py-1 text-[.7rem] font-bold uppercase tracking-wider text-amber-300">{ticket.status}</span>
        </div>
        {ticket.items.map((it, i) => (
          <div key={it.name} className={`flex justify-between gap-4 py-2 text-sm ${i ? "border-t border-emerald-50/10" : ""}`}>
            <div>
              {it.name}
              <small className="mt-0.5 block text-xs text-[#8fb3a6]">{it.note}</small>
            </div>
            <span className="tabular font-bold text-emerald-300">×{it.qty}</span>
          </div>
        ))}
        <div className="mt-3.5 h-1.5 overflow-hidden rounded-full bg-white/10">
          <i className="block h-full w-[58%] animate-tick rounded-full bg-[linear-gradient(90deg,#34d399,#fbbf24)]" />
        </div>
        <div className="mt-2 flex justify-between text-xs text-[#8fb3a6]">
          <span>{ticket.elapsed}</span>
          <span>{ticket.target}</span>
        </div>
        <button type="button" className="mt-3.5 w-full rounded-xl bg-emerald-400 py-3 font-bold text-emerald-950 transition-colors hover:bg-emerald-300">
          Mark ready · bump
        </button>
      </motion.div>
    </div>
  );
}

export function OrbsHero() {
  return (
    <section className="relative isolate flex min-h-dvh flex-col overflow-hidden">
      <Particles className="-z-20" />
      <div aria-hidden="true" className="pointer-events-none absolute -left-[12vw] -top-[14vw] -z-30 h-[48vw] w-[48vw] animate-orbit rounded-full bg-[radial-gradient(circle,#065f46,transparent_65%)] opacity-55 blur-[90px]" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-[12vw] -right-[10vw] -z-30 h-[40vw] w-[40vw] animate-orbit rounded-full bg-[radial-gradient(circle,#92400e,transparent_65%)] opacity-40 blur-[90px] [animation-duration:34s]" />
      <div aria-hidden="true" className="pointer-events-none absolute right-[15vw] top-[8vh] -z-30 h-[26vw] w-[26vw] animate-orbit rounded-full bg-[radial-gradient(circle,#0f766e,transparent_65%)] opacity-55 blur-[90px] [animation-duration:24s]" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 grain opacity-50 mix-blend-overlay" />

      <Reveal immediate className="mx-auto flex w-[min(1120px,100%-2.5rem)] items-center justify-between py-5" role="navigation" aria-label="Primary">
        <a href="#" className="inline-flex items-center gap-2.5 font-semibold">
          <img src={brand.logo} alt="" width={30} height={30} className="rounded-lg" /> {brand.name}
        </a>
        <div className="hidden gap-6 text-sm text-[#8fb3a6] md:flex">
          {nav.map((n) => (
            <a key={n.href} href={n.href} className="hover:text-emerald-50">
              {n.label}
            </a>
          ))}
        </div>
        <a href="/demo/" className="rounded-full border border-emerald-50/10 bg-white/5 px-4 py-2 text-sm font-semibold backdrop-blur-md hover:bg-white/10">
          {cta.nav}
        </a>
      </Reveal>

      <div className="mx-auto w-[min(900px,100%-2.5rem)] pb-4 pt-[clamp(2rem,7vh,4.5rem)] text-center">
        <Reveal immediate delay={0.05}>
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3.5 py-1.5 text-[.78rem] font-semibold uppercase tracking-[.08em] text-emerald-200">
            <i className="h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_12px_#fbbf24]" />
            Restaurant · Bar · Room service
          </span>
        </Reveal>
        <SplitText
          segments={[
            { text: "From table to kitchen to drawer," },
            { text: " in one tap.", className: "font-serif italic font-medium tracking-[-.01em] bg-[linear-gradient(90deg,#6ee7b7,#fbbf24)] bg-clip-text text-transparent" },
          ]}
          className="mb-5 mt-6 text-balance text-[clamp(2.6rem,7vw,5.2rem)] font-bold leading-[1] tracking-[-.035em]"
        />
        <Reveal immediate delay={0.7}>
          <p className="mx-auto max-w-[36rem] text-pretty text-[clamp(1.02rem,1.4vw,1.18rem)] leading-[1.65] text-[#8fb3a6]">
            {brand.name} runs the floor, the pass and the cash drawer as one system — so the Friday rush ends with a drawer that reconciles, not a pile of
            paper dockets.
          </p>
        </Reveal>
        <Reveal immediate delay={0.8} className="mt-8 flex flex-wrap justify-center gap-3">
          <a href="#pricing" className="inline-flex items-center rounded-full bg-emerald-400 px-5.5 py-3.5 text-[.95rem] font-semibold text-emerald-950 shadow-[0_10px_30px_-10px_rgba(52,211,153,.8)] transition-all hover:-translate-y-px hover:bg-emerald-300 hover:shadow-[0_16px_40px_-10px_rgba(52,211,153,.9)]">
            {cta.primary}
          </a>
          <a href="/demo/" className="inline-flex items-center gap-2 rounded-full border border-emerald-50/10 bg-white/5 px-5.5 py-3.5 text-[.95rem] font-semibold backdrop-blur-md transition-colors hover:border-white/25 hover:bg-white/10">
            Try the live demo <Play size={14} fill="currentColor" aria-hidden="true" />
          </a>
        </Reveal>
      </div>

      <Reveal immediate delay={0.9}>
        <TiltTicket />
      </Reveal>

      <Reveal immediate delay={1} className="mx-auto mb-12 grid w-[min(1120px,100%-2.5rem)] gap-px overflow-hidden rounded-2xl border border-emerald-50/10 bg-emerald-50/10 md:grid-cols-3">
        {[
          ["Cash + MoMo in one drawer", "Both tenders settle into the same shift and the same report."],
          ["Works when the network doesn't", "Orders queue offline and sync when the connection returns."],
          ["Phone, tablet or desktop", "One layout, from a 320px phone to the bar's touchscreen."],
        ].map(([h, b]) => (
          <div key={h} className="bg-[rgba(2,12,10,.6)] px-5 py-4.5 backdrop-blur">
            <b className="block text-[1.05rem] font-semibold tracking-tight">{h}</b>
            <span className="text-[.82rem] text-[#8fb3a6]">{b}</span>
          </div>
        ))}
      </Reveal>
    </section>
  );
}
