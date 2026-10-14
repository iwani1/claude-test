"use client";

import { brand, cta, faq, features, pricing, steps } from "@/content/site";
import { Faq } from "@/components/shared/Faq";
import { FeatureIcon } from "@/components/shared/Icon";
import { Reveal } from "@/components/shared/Reveal";
import { ThemeSwitcher } from "@/components/shared/ThemeSwitcher";
import { BrutalistHero } from "./Hero";

const INK = "border-[#111]";
const STAMP = ["#ffd400", "#ff3d2e", "#17b26a", "#2b4cff", "#ffd400", "#ff3d2e"];

function Kicker({ children }: { children: React.ReactNode }) {
  return <span className={`inline-block border-[3px] ${INK} bg-white px-3 py-1.5 font-mono text-[.8rem] font-bold uppercase tracking-[.1em] hard-sm`}>{children}</span>;
}
function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-5 max-w-3xl font-display text-[clamp(2rem,4.6vw,3.6rem)] font-black uppercase leading-[.95] tracking-[-.02em]">{children}</h2>;
}

export function BrutalistPage() {
  return (
    <div className="dot-paper bg-[#f4efe6] text-[#111] selection:bg-[#ffd400] selection:text-[#111]">
      <BrutalistHero />

      {/* how (steps) */}
      <section id="how" className={`scroll-mt-4 border-y-[3px] ${INK} bg-white py-20`}>
        <div className="mx-auto w-[min(1200px,100%-2.5rem)]">
          <Reveal>
            <Kicker>How a shift runs</Kicker>
            <H2>Three taps between the table and a drawer that balances.</H2>
          </Reveal>
          <ol className="mt-12 grid gap-6 md:grid-cols-3">
            {steps.map((s, i) => (
              <Reveal key={s.n} delay={0.1 * i} className="h-full">
                <li className={`relative h-full border-[3px] ${INK} bg-[#f4efe6] p-6 hard press`}>
                  <div className="font-display text-[2.8rem] leading-none [-webkit-text-stroke:2px_#111]" style={{ color: STAMP[i] }}>
                    {s.n}
                  </div>
                  <h3 className="mt-3 font-display text-[1.05rem] uppercase tracking-[-.01em]">{s.title}</h3>
                  <p className="mt-1.5 text-[.95rem] leading-relaxed">{s.body}</p>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* features */}
      <section id="features" className="scroll-mt-4 py-20">
        <div className="mx-auto w-[min(1200px,100%-2.5rem)]">
          <Reveal>
            <Kicker>Everything a shift needs</Kicker>
            <H2>
              The till, the kitchen and the stock room, <span className="bg-[#ffd400] px-[.1em]">finally agreeing</span>.
            </H2>
          </Reveal>
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <Reveal key={f.title} delay={0.06 * i} className="h-full">
                <article className={`group h-full border-[3px] ${INK} bg-white p-6 hard press`}>
                  <div className={`inline-grid h-12 w-12 place-items-center border-[3px] ${INK}`} style={{ background: STAMP[i] }}>
                    <FeatureIcon name={f.icon} size={22} strokeWidth={2.5} className={STAMP[i] === "#2b4cff" || STAMP[i] === "#ff3d2e" ? "text-white" : "text-[#111]"} />
                  </div>
                  <h3 className="mt-5 font-display text-[1.05rem] uppercase leading-tight tracking-[-.01em]">{f.title}</h3>
                  <p className="mt-2 text-[.95rem] leading-relaxed">{f.body}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* pricing */}
      <section id="pricing" className={`scroll-mt-4 border-y-[3px] ${INK} bg-[#111] py-20 text-[#f4efe6]`}>
        <div className="mx-auto w-[min(1200px,100%-2.5rem)]">
          <Reveal>
            <span className="inline-block border-[3px] border-[#f4efe6] px-3 py-1.5 font-mono text-[.8rem] font-bold uppercase tracking-[.1em]">Pricing</span>
            <H2>
              Pay once. <span className="bg-[#ffd400] px-[.1em] text-[#111]">Own it.</span> No per-month fee for software in your own building.
            </H2>
          </Reveal>
          <div className="mt-12 grid gap-8 lg:grid-cols-3">
            {pricing.map((t, i) => (
              <Reveal key={t.name} delay={0.08 * i} className="h-full">
                <article className={`relative flex h-full flex-col border-[3px] ${INK} p-6 text-[#111] shadow-[8px_8px_0_#ffd400] ${t.featured ? "bg-[#ffd400] shadow-[8px_8px_0_#f4efe6]" : "bg-white"}`}>
                  {t.featured && <span className={`absolute -top-4 left-6 border-[3px] ${INK} bg-[#ff3d2e] px-3 py-1 font-display text-[.7rem] uppercase tracking-[.1em] text-white`}>Most venues</span>}
                  <h3 className="font-display text-lg uppercase">{t.name}</h3>
                  <div className="mt-4 font-display text-4xl uppercase tracking-[-.02em]">{t.price}</div>
                  <div className="mt-1 font-mono text-xs font-bold uppercase tracking-wider">{t.period}</div>
                  <p className="mt-4 text-sm font-medium leading-relaxed">{t.blurb}</p>
                  <ul className="mt-6 space-y-2 text-sm font-medium">
                    {t.points.map((p) => (
                      <li key={p} className="flex gap-2.5">
                        <span aria-hidden="true" className="font-mono font-black">
                          ■
                        </span>
                        {p}
                      </li>
                    ))}
                  </ul>
                  <a href="#" className={`mt-8 inline-flex items-center justify-center border-[3px] ${INK} px-5 py-3 text-sm font-extrabold uppercase tracking-[.06em] hard press ${t.featured ? "bg-[#111] text-[#ffd400] hover:bg-[#2b4cff] hover:text-white" : "bg-white hover:bg-[#111] hover:text-[#ffd400]"}`}>
                    {t.cta}
                  </a>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* faq */}
      <section id="faq" className="scroll-mt-4 py-20">
        <div className="mx-auto grid w-[min(1200px,100%-2.5rem)] gap-10 lg:grid-cols-[.8fr_1.2fr]">
          <Reveal>
            <Kicker>Questions</Kicker>
            <H2>The ones every owner asks before the first shift.</H2>
            <p className="mt-4 font-medium">Anything else — the pilot comes with a human on WhatsApp during service.</p>
          </Reveal>
          <Reveal delay={0.1} className={`border-[3px] ${INK} bg-white hard`}>
            <Faq
              items={faq}
              itemClassName={`border-b-[3px] last:border-b-0 ${INK}`}
              buttonClassName="px-5 py-4 font-display text-[1rem] uppercase leading-tight tracking-[-.01em] hover:bg-[#ffd400]"
              panelClassName="px-5 pb-5 pt-1 text-[.95rem] font-medium leading-relaxed"
              indicator={(open) => (
                <span className={`grid h-8 w-8 shrink-0 place-items-center border-[3px] ${INK} font-mono text-lg font-black ${open ? "bg-[#111] text-[#ffd400]" : "bg-white"}`} aria-hidden="true">
                  {open ? "–" : "+"}
                </span>
              )}
            />
          </Reveal>
        </div>
      </section>

      {/* cta */}
      <section className={`border-t-[3px] ${INK} bg-[#ffd400] py-20`}>
        <Reveal className="mx-auto w-[min(1200px,100%-2.5rem)] text-center">
          <h2 className="font-display text-[clamp(2.6rem,8vw,7rem)] font-black uppercase leading-[.9] tracking-[-.03em]">
            Ready for
            <br />
            Friday night?
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg font-medium">Run one real shift on your own menu. If the drawer doesn&apos;t balance, you owe us nothing.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <a href="#pricing" className={`inline-flex items-center border-[3px] ${INK} bg-[#111] px-7 py-4 font-extrabold uppercase tracking-[.06em] text-[#ffd400] hard press hover:bg-[#2b4cff] hover:text-white`}>
              {cta.primary} →
            </a>
            <a href="#how" className={`inline-flex items-center border-[3px] ${INK} bg-white px-7 py-4 font-extrabold uppercase tracking-[.06em] hard press`}>
              {cta.secondary}
            </a>
          </div>
          <p className="mt-5 font-mono text-xs font-bold uppercase tracking-wider">{cta.micro}</p>
        </Reveal>
      </section>
      <footer className={`border-t-[3px] ${INK} bg-[#111] py-6 font-mono text-xs font-bold uppercase tracking-wider text-[#f4efe6]`}>
        <div className="mx-auto flex w-[min(1200px,100%-2.5rem)] flex-wrap items-center justify-between gap-4">
          <span>{brand.name}</span>
          <span>
            © {new Date().getFullYear()} {brand.company} · {brand.city}
          </span>
        </div>
      </footer>
      <ThemeSwitcher tone="ink" />
    </div>
  );
}
