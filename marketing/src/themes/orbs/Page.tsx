"use client";

import { ArrowRight, Check } from "lucide-react";
import { brand, cta, faq, features, pricing, steps } from "@/content/site";
import { Faq } from "@/components/shared/Faq";
import { FeatureIcon } from "@/components/shared/Icon";
import { Reveal } from "@/components/shared/Reveal";
import { ThemeSwitcher } from "@/components/shared/ThemeSwitcher";
import { OrbsHero } from "./Hero";

const MUTED = "text-[#8fb3a6]";
const LINE = "border-emerald-50/10";

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-[.18em] text-emerald-300">{children}</p>;
}
function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-3 text-balance text-3xl font-bold tracking-[-.03em] md:text-[2.6rem] md:leading-[1.06]">{children}</h2>;
}
function Serif({ children }: { children: React.ReactNode }) {
  return <em className="font-serif font-medium italic text-emerald-200">{children}</em>;
}

export function OrbsPage() {
  return (
    <div className="bg-[#020c0a] text-emerald-50 selection:bg-emerald-400 selection:text-emerald-950">
      <OrbsHero />

      {/* features */}
      <section id="features" className="relative scroll-mt-20 py-24">
        <div aria-hidden="true" className="pointer-events-none absolute -left-40 top-20 -z-10 h-[420px] w-[420px] rounded-full bg-emerald-800/30 blur-[120px]" />
        <div className="mx-auto w-[min(1120px,100%-2.5rem)]">
          <Reveal className="max-w-2xl">
            <Eyebrow>Everything a shift needs</Eyebrow>
            <H2>
              The till, the kitchen and the stock room, <Serif>finally agreeing</Serif> with each other.
            </H2>
          </Reveal>
          <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <Reveal key={f.title} delay={0.06 * i} className="h-full">
                <article className={`group h-full rounded-2xl border ${LINE} bg-white/[.03] p-6 backdrop-blur transition-colors hover:border-emerald-400/30 hover:bg-emerald-400/[.05]`}>
                  <div className="inline-grid h-11 w-11 place-items-center rounded-full border border-emerald-400/20 bg-emerald-400/10 text-emerald-300 transition-colors group-hover:bg-emerald-400 group-hover:text-emerald-950">
                    <FeatureIcon name={f.icon} size={20} />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold tracking-tight">{f.title}</h3>
                  <p className={`mt-2 text-pretty text-[.95rem] leading-relaxed ${MUTED}`}>{f.body}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* how: a ticket's journey */}
      <section id="how" className="scroll-mt-20 py-24">
        <div className="mx-auto w-[min(1120px,100%-2.5rem)]">
          <Reveal className="max-w-2xl">
            <Eyebrow>How a shift runs</Eyebrow>
            <H2>
              Three taps between the table and a drawer that <Serif>balances</Serif>.
            </H2>
          </Reveal>
          <ol className="mt-12 grid gap-4 md:grid-cols-3">
            {steps.map((s, i) => (
              <Reveal key={s.n} delay={0.1 * i} className="h-full">
                <li className={`relative h-full overflow-hidden rounded-2xl border ${LINE} bg-[linear-gradient(160deg,rgba(255,255,255,.06),rgba(255,255,255,.02))] p-6`}>
                  <span aria-hidden="true" className="absolute -right-3 -top-6 font-serif text-[7rem] italic leading-none text-emerald-400/10">
                    {s.n}
                  </span>
                  <span className="font-mono text-xs text-amber-300">{s.n}</span>
                  <h3 className="mt-3 text-xl font-semibold tracking-tight">{s.title}</h3>
                  <p className={`mt-2 text-pretty leading-relaxed ${MUTED}`}>{s.body}</p>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* pricing */}
      <section id="pricing" className="relative scroll-mt-20 py-24">
        <div aria-hidden="true" className="pointer-events-none absolute -right-40 top-10 -z-10 h-[460px] w-[460px] rounded-full bg-amber-700/20 blur-[120px]" />
        <div className="mx-auto w-[min(1120px,100%-2.5rem)]">
          <Reveal className="max-w-2xl">
            <Eyebrow>Pricing</Eyebrow>
            <H2>
              Pay once, <Serif>own it</Serif>. No per-month fee for software that runs in your own building.
            </H2>
          </Reveal>
          <div className="mt-12 grid gap-4 lg:grid-cols-3">
            {pricing.map((t, i) => (
              <Reveal key={t.name} delay={0.08 * i} className="h-full">
                <article className={`relative flex h-full flex-col rounded-2xl border p-6 backdrop-blur ${t.featured ? "border-emerald-400/50 bg-emerald-400/[.06] shadow-[0_30px_80px_-40px_rgba(52,211,153,.6)]" : `${LINE} bg-white/[.03]`}`}>
                  {t.featured && <span className="absolute -top-3 left-6 rounded-full bg-emerald-400 px-3 py-1 text-[.7rem] font-bold uppercase tracking-wider text-emerald-950">Most venues</span>}
                  <h3 className="text-lg font-semibold">{t.name}</h3>
                  <div className="mt-4 font-serif text-4xl font-medium tracking-tight">{t.price}</div>
                  <div className={`mt-1 text-sm ${MUTED}`}>{t.period}</div>
                  <p className="mt-4 text-pretty text-sm leading-relaxed text-emerald-50/80">{t.blurb}</p>
                  <ul className="mt-6 space-y-2.5 text-sm">
                    {t.points.map((p) => (
                      <li key={p} className="flex gap-2.5">
                        <Check size={16} strokeWidth={2.5} className="mt-0.5 shrink-0 text-amber-300" aria-hidden="true" />
                        <span className="text-emerald-50/80">{p}</span>
                      </li>
                    ))}
                  </ul>
                  <a href="#" className={`mt-8 inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition-colors ${t.featured ? "bg-emerald-400 text-emerald-950 hover:bg-emerald-300" : `border ${LINE} bg-white/5 hover:bg-white/10`}`}>
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
            <p className={`mt-4 ${MUTED}`}>Anything else — the pilot comes with a human on WhatsApp during service.</p>
          </Reveal>
          <Reveal delay={0.1}>
            <Faq
              items={faq}
              itemClassName={`border-b ${LINE}`}
              buttonClassName="py-5 text-base font-semibold hover:text-emerald-200"
              panelClassName={`pb-5 pr-10 text-pretty leading-relaxed ${MUTED}`}
              indicator={(open) => (
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border ${LINE} text-sm transition-transform ${open ? "rotate-45 bg-emerald-400 text-emerald-950" : ""}`} aria-hidden="true">
                  +
                </span>
              )}
            />
          </Reveal>
        </div>
      </section>

      {/* cta */}
      <section className="relative overflow-hidden py-28">
        <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(52,211,153,.35),transparent_65%)] blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 grain opacity-40 mix-blend-overlay" />
        <Reveal className="mx-auto w-[min(820px,100%-2.5rem)] text-center">
          <h2 className="text-balance text-4xl font-bold tracking-tight md:text-6xl">
            Ready for <Serif>Friday night</Serif>?
          </h2>
          <p className={`mx-auto mt-5 max-w-xl text-pretty text-lg ${MUTED}`}>Run one real shift on your own menu. If the drawer doesn&apos;t balance, you owe us nothing.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a href="#pricing" className="inline-flex items-center gap-2 rounded-full bg-emerald-400 px-6 py-3.5 font-semibold text-emerald-950 shadow-[0_10px_30px_-10px_rgba(52,211,153,.8)] hover:bg-emerald-300">
              {cta.primary} <ArrowRight size={16} aria-hidden="true" />
            </a>
            <a href="#how" className={`inline-flex items-center rounded-full border ${LINE} bg-white/5 px-6 py-3.5 font-semibold backdrop-blur hover:bg-white/10`}>
              {cta.secondary}
            </a>
          </div>
          <p className="mt-4 text-xs text-emerald-50/50">{cta.micro}</p>
        </Reveal>
      </section>
      <footer className={`border-t ${LINE} py-8 text-sm ${MUTED}`}>
        <div className="mx-auto flex w-[min(1120px,100%-2.5rem)] flex-wrap items-center justify-between gap-4">
          <span className="inline-flex items-center gap-2 text-emerald-50">
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
