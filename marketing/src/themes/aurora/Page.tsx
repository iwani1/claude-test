"use client";

import { ArrowRight, Check } from "lucide-react";
import { brand, cta, faq, features, pricing, steps } from "@/content/site";
import { Faq } from "@/components/shared/Faq";
import { FeatureIcon } from "@/components/shared/Icon";
import { Reveal } from "@/components/shared/Reveal";
import { ThemeSwitcher } from "@/components/shared/ThemeSwitcher";
import { AuroraHero } from "./Hero";

const GRAD = "bg-[linear-gradient(90deg,#c4b5fd,#67e8f9_50%,#f0abfc)] bg-clip-text text-transparent";

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-[.18em] text-violet-300/80">{children}</p>;
}
function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight md:text-[2.6rem] md:leading-[1.08]">{children}</h2>;
}

export function AuroraPage() {
  return (
    <div className="bg-[#05010f] text-zinc-50 selection:bg-violet-500 selection:text-white">
      <AuroraHero />

      {/* features */}
      <section id="features" className="relative scroll-mt-20 py-24">
        <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-violet-700/20 blur-[120px]" />
        <div className="mx-auto w-[min(1180px,100%-2.5rem)]">
          <Reveal className="max-w-2xl">
            <Eyebrow>Everything a shift needs</Eyebrow>
            <H2>
              The till, the kitchen and the stock room, <span className={GRAD}>finally agreeing</span> with each other.
            </H2>
          </Reveal>
          <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <Reveal key={f.title} delay={0.06 * i}>
                <article className="group relative h-full rounded-2xl border border-white/10 bg-white/[.03] p-6 transition-colors hover:border-white/20 hover:bg-white/[.05]">
                  <div className="inline-grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-[linear-gradient(160deg,rgba(124,58,237,.35),rgba(34,211,238,.15))] text-white">
                    <FeatureIcon name={f.icon} size={20} />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold tracking-tight">{f.title}</h3>
                  <p className="mt-2 text-pretty text-[.95rem] leading-relaxed text-zinc-400">{f.body}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* how it works */}
      <section id="how" className="scroll-mt-20 py-24">
        <div className="mx-auto w-[min(1180px,100%-2.5rem)]">
          <Reveal className="max-w-2xl">
            <Eyebrow>How a shift runs</Eyebrow>
            <H2>Three taps between the table and a drawer that balances.</H2>
          </Reveal>
          <ol className="relative mt-14 grid gap-10 md:grid-cols-3 md:gap-6">
            <div aria-hidden="true" className="absolute left-0 right-0 top-6 hidden h-px bg-[linear-gradient(90deg,transparent,rgba(196,181,253,.5),rgba(103,232,249,.5),transparent)] md:block" />
            {steps.map((s, i) => (
              <Reveal key={s.n} delay={0.1 * i}>
                <li className="relative">
                  <div className="relative z-10 inline-grid h-12 w-12 place-items-center rounded-full border border-white/15 bg-[#05010f] font-mono text-sm text-cyan-200 shadow-[0_0_30px_-6px_rgba(103,232,249,.6)]">
                    {s.n}
                  </div>
                  <h3 className="mt-5 text-xl font-semibold tracking-tight">{s.title}</h3>
                  <p className="mt-2 text-pretty leading-relaxed text-zinc-400">{s.body}</p>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* pricing */}
      <section id="pricing" className="relative scroll-mt-20 py-24">
        <div aria-hidden="true" className="pointer-events-none absolute right-0 top-10 -z-10 h-[460px] w-[700px] rounded-full bg-cyan-500/10 blur-[120px]" />
        <div className="mx-auto w-[min(1180px,100%-2.5rem)]">
          <Reveal className="max-w-2xl">
            <Eyebrow>Pricing</Eyebrow>
            <H2>
              Pay once, <span className={GRAD}>own it</span>. No per-month fee for software that runs in your own building.
            </H2>
          </Reveal>
          <div className="mt-12 grid gap-4 lg:grid-cols-3">
            {pricing.map((t, i) => (
              <Reveal key={t.name} delay={0.08 * i} className="h-full">
                <article
                  className={`relative flex h-full flex-col rounded-2xl p-6 ${
                    t.featured
                      ? "border border-transparent bg-[linear-gradient(#0b0620,#0b0620)_padding-box,linear-gradient(135deg,#7c3aed,#22d3ee,#e879f9)_border-box] shadow-[0_30px_80px_-40px_rgba(124,58,237,.9)]"
                      : "border border-white/10 bg-white/[.03]"
                  }`}
                >
                  {t.featured && (
                    <span className="absolute -top-3 left-6 rounded-full bg-white px-3 py-1 text-[.7rem] font-bold uppercase tracking-wider text-zinc-950">
                      Most venues
                    </span>
                  )}
                  <h3 className="text-lg font-semibold">{t.name}</h3>
                  <div className="mt-4 text-4xl font-bold tracking-tight">{t.price}</div>
                  <div className="mt-1 text-sm text-zinc-400">{t.period}</div>
                  <p className="mt-4 text-pretty text-sm leading-relaxed text-zinc-300">{t.blurb}</p>
                  <ul className="mt-6 space-y-2.5 text-sm">
                    {t.points.map((p) => (
                      <li key={p} className="flex gap-2.5">
                        <Check size={16} strokeWidth={2.5} className="mt-0.5 shrink-0 text-emerald-400" aria-hidden="true" />
                        <span className="text-zinc-300">{p}</span>
                      </li>
                    ))}
                  </ul>
                  <a
                    href="#"
                    className={`mt-8 inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-all ${
                      t.featured
                        ? "bg-white text-zinc-950 shadow-[0_12px_40px_-12px_rgba(124,58,237,.75)] hover:-translate-y-px"
                        : "border border-white/15 bg-white/[.03] hover:border-white/30 hover:bg-white/10"
                    }`}
                  >
                    {t.cta}
                  </a>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* faq */}
      <section id="faq" className="scroll-mt-20 py-24">
        <div className="mx-auto grid w-[min(1180px,100%-2.5rem)] gap-10 lg:grid-cols-[.8fr_1.2fr]">
          <Reveal>
            <Eyebrow>Questions</Eyebrow>
            <H2>The ones every owner asks before the first shift.</H2>
            <p className="mt-4 text-zinc-400">Anything else — the pilot comes with a human on WhatsApp during service.</p>
          </Reveal>
          <Reveal delay={0.1}>
            <Faq
              items={faq}
              itemClassName="border-b border-white/10"
              buttonClassName="py-5 text-base font-semibold hover:text-cyan-200"
              panelClassName="pb-5 pr-10 text-pretty leading-relaxed text-zinc-400"
              indicator={(open) => (
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/15 text-sm transition-transform ${open ? "rotate-45" : ""}`} aria-hidden="true">
                  +
                </span>
              )}
            />
          </Reveal>
        </div>
      </section>

      {/* cta + footer */}
      <section className="relative overflow-hidden py-28">
        <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[500px] w-[1000px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse,rgba(124,58,237,.35),rgba(34,211,238,.12)_50%,transparent_70%)] blur-3xl" />
        <Reveal className="mx-auto w-[min(820px,100%-2.5rem)] text-center">
          <h2 className="text-balance text-4xl font-bold tracking-tight md:text-6xl">
            Ready for <span className={GRAD}>Friday night</span>?
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-lg text-zinc-400">
            Run one real shift on your own menu. If the drawer doesn&apos;t balance, you owe us nothing.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a href="#pricing" className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 font-semibold text-zinc-950 shadow-[0_12px_40px_-12px_rgba(124,58,237,.75)] transition-transform hover:-translate-y-px">
              {cta.primary} <ArrowRight size={16} aria-hidden="true" />
            </a>
            <a href="#how" className="inline-flex items-center rounded-xl border border-white/15 bg-white/[.03] px-6 py-3.5 font-semibold backdrop-blur hover:bg-white/10">
              {cta.secondary}
            </a>
          </div>
          <p className="mt-4 text-xs text-zinc-500">{cta.micro}</p>
        </Reveal>
      </section>
      <footer className="border-t border-white/10 py-8 text-sm text-zinc-500">
        <div className="mx-auto flex w-[min(1180px,100%-2.5rem)] flex-wrap items-center justify-between gap-4">
          <span className="inline-flex items-center gap-2 text-zinc-300">
            <img src={brand.logo} alt="" width={20} height={20} className="rounded-md" /> {brand.name}
          </span>
          <span>
            © {new Date().getFullYear()} {brand.company}, {brand.city}
          </span>
        </div>
      </footer>
      <ThemeSwitcher tone="dark" />
    </div>
  );
}
