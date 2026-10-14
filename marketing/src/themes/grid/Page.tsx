"use client";

import { ArrowRight, Check, Minus, Plus } from "lucide-react";
import { brand, cta, faq, features, pricing, steps } from "@/content/site";
import { Faq } from "@/components/shared/Faq";
import { FeatureIcon } from "@/components/shared/Icon";
import { Reveal } from "@/components/shared/Reveal";
import { ThemeSwitcher } from "@/components/shared/ThemeSwitcher";
import { GridHero } from "./Hero";

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-[.18em] text-emerald-600">{children}</p>;
}
function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-3 text-balance text-3xl font-bold tracking-[-.03em] md:text-[2.5rem] md:leading-[1.08]">{children}</h2>;
}

export function GridPage() {
  return (
    <div className="bg-[#fafafa] text-zinc-950 selection:bg-emerald-200 selection:text-emerald-950">
      <GridHero />

      {/* features: hairline grid */}
      <section id="features" className="scroll-mt-20 border-y border-zinc-200 bg-white py-24">
        <div className="mx-auto w-[min(1120px,100%-2.5rem)]">
          <Reveal className="max-w-2xl">
            <Eyebrow>Everything a shift needs</Eyebrow>
            <H2>The till, the kitchen and the stock room, finally agreeing with each other.</H2>
          </Reveal>
          <div className="mt-12 grid overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-200 gap-px md:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <Reveal key={f.title} delay={0.05 * i} className="h-full">
                <article className="group h-full bg-white p-7 transition-colors hover:bg-emerald-50/40">
                  <div className="inline-grid h-10 w-10 place-items-center rounded-lg border border-zinc-200 bg-zinc-50 text-emerald-700 transition-colors group-hover:border-emerald-200 group-hover:bg-white">
                    <FeatureIcon name={f.icon} size={18} />
                  </div>
                  <h3 className="mt-5 text-[1.05rem] font-semibold tracking-tight">{f.title}</h3>
                  <p className="mt-2 text-pretty text-[.92rem] leading-relaxed text-zinc-500">{f.body}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* how */}
      <section id="how" className="scroll-mt-20 py-24">
        <div className="mx-auto w-[min(1120px,100%-2.5rem)]">
          <Reveal className="max-w-2xl">
            <Eyebrow>How a shift runs</Eyebrow>
            <H2>Three taps between the table and a drawer that balances.</H2>
          </Reveal>
          <ol className="mt-12 grid gap-4 md:grid-cols-3">
            {steps.map((s, i) => (
              <Reveal key={s.n} delay={0.08 * i} className="h-full">
                <li className="relative h-full rounded-2xl border border-zinc-200 bg-white p-7">
                  <span className="font-mono text-sm font-semibold text-emerald-600">{s.n}</span>
                  <h3 className="mt-3 text-xl font-semibold tracking-tight">{s.title}</h3>
                  <p className="mt-2 text-pretty leading-relaxed text-zinc-500">{s.body}</p>
                  {i < steps.length - 1 && (
                    <ArrowRight aria-hidden="true" size={18} className="absolute -right-3.5 top-1/2 hidden -translate-y-1/2 rounded-full border border-zinc-200 bg-white p-0.5 text-zinc-400 md:block" />
                  )}
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* pricing */}
      <section id="pricing" className="scroll-mt-20 border-y border-zinc-200 bg-white py-24">
        <div className="mx-auto w-[min(1120px,100%-2.5rem)]">
          <Reveal className="max-w-2xl">
            <Eyebrow>Pricing</Eyebrow>
            <H2>Pay once, own it. No per-month fee for software that runs in your own building.</H2>
          </Reveal>
          <div className="mt-12 grid gap-4 lg:grid-cols-3">
            {pricing.map((t, i) => (
              <Reveal key={t.name} delay={0.08 * i} className="h-full">
                <article className={`relative flex h-full flex-col rounded-2xl border bg-white p-7 ${t.featured ? "border-beam border-zinc-200 shadow-[0_24px_60px_-30px_rgba(5,150,105,.35)]" : "border-zinc-200"}`}>
                  {t.featured && <span className="absolute -top-3 left-7 rounded-full bg-zinc-950 px-3 py-1 text-[.7rem] font-bold uppercase tracking-wider text-white">Most venues</span>}
                  <h3 className="text-lg font-semibold">{t.name}</h3>
                  <div className="mt-4 text-4xl font-bold tracking-tight">{t.price}</div>
                  <div className="mt-1 text-sm text-zinc-500">{t.period}</div>
                  <p className="mt-4 text-pretty text-sm leading-relaxed text-zinc-600">{t.blurb}</p>
                  <ul className="mt-6 space-y-2.5 text-sm">
                    {t.points.map((p) => (
                      <li key={p} className="flex gap-2.5">
                        <Check size={16} strokeWidth={2.5} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />
                        <span className="text-zinc-700">{p}</span>
                      </li>
                    ))}
                  </ul>
                  <a
                    href="#"
                    className={`mt-8 inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold transition-colors ${
                      t.featured ? "bg-zinc-950 text-white hover:bg-zinc-800" : "border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50"
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
        <div className="mx-auto grid w-[min(1120px,100%-2.5rem)] gap-10 lg:grid-cols-[.8fr_1.2fr]">
          <Reveal>
            <Eyebrow>Questions</Eyebrow>
            <H2>The ones every owner asks before the first shift.</H2>
            <p className="mt-4 text-zinc-500">Anything else — the pilot comes with a human on WhatsApp during service.</p>
          </Reveal>
          <Reveal delay={0.1}>
            <Faq
              items={faq}
              itemClassName="border-b border-zinc-200"
              buttonClassName="py-5 text-base font-semibold hover:text-emerald-700"
              panelClassName="pb-5 pr-10 text-pretty leading-relaxed text-zinc-500"
              indicator={(open) => (
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-zinc-200 text-zinc-600" aria-hidden="true">
                  {open ? <Minus size={14} /> : <Plus size={14} />}
                </span>
              )}
            />
          </Reveal>
        </div>
      </section>

      {/* cta */}
      <section className="py-10">
        <Reveal className="mx-auto w-[min(1120px,100%-2.5rem)]">
          <div className="relative overflow-hidden rounded-3xl bg-zinc-950 px-8 py-16 text-center text-white md:py-20">
            <div aria-hidden="true" className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-emerald-500/30 blur-3xl" />
            <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-amber-400/20 blur-3xl" />
            <h2 className="text-balance text-4xl font-bold tracking-tight md:text-5xl">Ready for Friday night?</h2>
            <p className="mx-auto mt-4 max-w-xl text-pretty text-zinc-300">Run one real shift on your own menu. If the drawer doesn&apos;t balance, you owe us nothing.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <a href="#pricing" className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 font-semibold text-zinc-950 hover:bg-zinc-100">
                {cta.primary} <ArrowRight size={16} aria-hidden="true" />
              </a>
              <a href="#how" className="inline-flex items-center rounded-xl border border-white/20 px-6 py-3.5 font-semibold hover:bg-white/10">
                {cta.secondary}
              </a>
            </div>
            <p className="mt-4 text-xs text-zinc-400">{cta.micro}</p>
          </div>
        </Reveal>
      </section>
      <footer className="py-10 text-sm text-zinc-500">
        <div className="mx-auto flex w-[min(1120px,100%-2.5rem)] flex-wrap items-center justify-between gap-4">
          <span className="inline-flex items-center gap-2 text-zinc-800">
            <img src={brand.logo} alt="" width={20} height={20} className="rounded-md" /> {brand.name}
          </span>
          <span>
            © {new Date().getFullYear()} {brand.company}, {brand.city}
          </span>
        </div>
      </footer>
      <ThemeSwitcher tone="light" />
    </div>
  );
}
