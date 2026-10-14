"use client";

import { brand, cta, nav, receipt } from "@/content/site";
import { Reveal } from "@/components/shared/Reveal";

const TICKER = ["Lush View POS", "Cash & MoMo", "Kitchen tickets", "Stock that deducts itself", "GRA VAT on every receipt", "Works offline", "Phone · Tablet · Desktop", "No cloud fees"];
const INK = "border-[#111]";

function Ticker() {
  const items = [...TICKER, ...TICKER];
  return (
    <div aria-hidden="true" className={`overflow-hidden border-b-[3px] ${INK} bg-[#111] text-[#f4efe6]`}>
      <div className="flex w-max animate-ticker">
        {items.map((t, i) => (
          <span key={i} className="whitespace-nowrap px-5 py-2 font-display text-[.8rem] uppercase tracking-[.14em]">
            {i % 2 ? <b className="text-[#ffd400]">★ </b> : null}
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Stepped easing: six discrete frames, no smoothing — the entrance should feel mechanical. */
const stepped = (t: number) => (t >= 1 ? 1 : Math.floor(t * 6) / 6);

function Snap({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <Reveal immediate delay={delay} x={-10} y={0} transition={{ duration: 0.5, delay, ease: stepped }} className={className}>
      {children}
    </Reveal>
  );
}

export function BrutalistHero() {
  const fmt = (n: number) => n.toFixed(2);
  return (
    <section className="flex min-h-dvh flex-col">
      <Ticker />
      <nav aria-label="Primary" className={`flex items-stretch border-b-[3px] ${INK} bg-[#f4efe6]`}>
        <a href="#" className={`flex items-center gap-3 border-r-[3px] ${INK} px-5 py-3.5 font-display text-base uppercase`}>
          <span className={`relative h-[30px] w-[30px] rounded-full border-[3px] ${INK} bg-[#17b26a] after:absolute after:-right-1.5 after:-top-1.5 after:h-3 after:w-3 after:rounded-full after:border-[3px] after:border-[#111] after:bg-[#ffd400] after:content-['']`} />
          {brand.name}
        </a>
        <div className="hidden lg:flex">
          {nav.map((n) => (
            <a key={n.href} href={n.href} className={`flex items-center border-r-[3px] ${INK} px-5 text-sm font-bold transition-colors hover:bg-[#111] hover:text-[#ffd400]`}>
              {n.label}
            </a>
          ))}
        </div>
        <div className="flex-1" />
        <a href="#pricing" className={`flex items-center border-l-[3px] ${INK} bg-[#ffd400] px-5 text-sm font-extrabold uppercase tracking-[.06em] transition-colors hover:bg-[#111] hover:text-[#ffd400]`}>
          {cta.nav} →
        </a>
      </nav>

      <div className="mx-auto grid w-[min(1200px,100%-2.5rem)] flex-1 items-center gap-10 py-[clamp(2rem,6vh,4rem)] pb-12 lg:grid-cols-[7fr_5fr] lg:gap-12">
        <div>
          <Snap>
            <span className={`inline-block border-[3px] ${INK} bg-white px-3 py-1.5 font-mono text-[.8rem] font-bold uppercase tracking-[.1em] hard-sm`}>
              Restaurant · Bar · Room service · {brand.city}
            </span>
          </Snap>
          <Snap delay={0.1}>
            <h1 className="my-5 font-display text-[clamp(2.6rem,7.4vw,6rem)] font-black uppercase leading-[.92] tracking-[-.03em]">
              <span className="block">The till that</span>
              <span className="block">keeps up with</span>
              <span className="block">
                a <span className="inline-block -rotate-[1.2deg] bg-[#ffd400] px-[.12em] shadow-[6px_6px_0_#111]">Friday</span> night.
              </span>
            </h1>
          </Snap>
          <Snap delay={0.2}>
            <p className="max-w-[36rem] text-[clamp(1.05rem,1.5vw,1.25rem)] font-medium leading-[1.55]">
              Orders in, tickets to the pass, Cash or MoMo out — and a drawer that <b className="bg-[#111] px-[.3em] font-medium text-[#f4efe6]">reconciles to the cedi</b> when the last table leaves.
            </p>
          </Snap>
          <Snap delay={0.3} className="mt-8 flex flex-wrap gap-4">
            <a href="#pricing" className={`inline-flex items-center gap-2 border-[3px] ${INK} bg-[#111] px-5.5 py-3.5 text-sm font-extrabold uppercase tracking-[.06em] text-[#ffd400] hard press hover:bg-[#2b4cff] hover:text-white`}>
              Start a shift →
            </a>
            <a href="#how" className={`inline-flex items-center border-[3px] ${INK} bg-white px-5.5 py-3.5 text-sm font-extrabold uppercase tracking-[.06em] hard press`}>
              See the kitchen screen
            </a>
          </Snap>
          <Snap delay={0.4} className="mt-7 flex flex-wrap gap-2.5">
            {[
              ["Cash & MoMo", "#17b26a"],
              ["GRA VAT", "#2b4cff"],
              ["Works offline", "#ff3d2e"],
              ["Phone → desktop", "#ffd400"],
            ].map(([t, c]) => (
              <span key={t} className={`border-2 ${INK} bg-[#f4efe6] px-2.5 py-1.5 font-mono text-xs font-bold`}>
                <span style={{ color: c }}>■ </span>
                {t}
              </span>
            ))}
          </Snap>
        </div>

        {/* receipt */}
        <Snap delay={0.25} className="group relative flex justify-center py-6 pb-8">
          <div
            role="img"
            aria-label="Mock-up of a printed receipt"
            className={`torn relative w-full max-w-[360px] -rotate-2 border-[3px] border-b-0 ${INK} bg-white px-5 pb-6 pt-5 font-mono text-[.82rem] leading-[1.5] hard transition-transform duration-300 group-hover:rotate-0 group-hover:scale-[1.01]`}
          >
            <h2 className="text-center font-display text-xl uppercase tracking-[-.01em]">{brand.company}</h2>
            <div className="text-center">
              Restaurant &amp; Bar · {brand.city}
              <br />
              Receipt {receipt.number} · {receipt.when}
            </div>
            <hr className={`my-3 border-0 border-t-2 border-dashed ${INK}`} />
            {receipt.lines.map((l) => (
              <div key={l.name} className="flex justify-between gap-4">
                <span>
                  {l.qty}× {l.name}
                </span>
                <span>{fmt(l.amount)}</span>
              </div>
            ))}
            <hr className={`my-3 border-0 border-t-2 border-dashed ${INK}`} />
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{fmt(receipt.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>VAT 15%</span>
              <span>{fmt(receipt.tax)}</span>
            </div>
            <div className="flex justify-between text-[1.05rem] font-extrabold">
              <span>TOTAL GH₵</span>
              <span>{fmt(receipt.total)}</span>
            </div>
            <div className="flex justify-between">
              <span>{receipt.tender}</span>
              <span>{fmt(receipt.total)}</span>
            </div>
            <div className="text-center">
              <span className="mt-3 inline-block -rotate-6 border-[3px] border-[#17b26a] px-3 py-1 font-display font-black uppercase tracking-[.12em] text-[#17b26a]">Paid</span>
            </div>
            <div aria-hidden="true" className="barcode mt-3.5 h-11" />
            <div className="mt-2 text-center">{receipt.footer}</div>
          </div>
          <div
            aria-hidden="true"
            className={`absolute -right-1.5 -top-3.5 grid h-[118px] w-[118px] rotate-[10deg] animate-wobble place-items-center rounded-full border-[3px] ${INK} bg-[#ff3d2e] p-2.5 text-center font-display text-[.8rem] uppercase leading-[1.05] text-white hard-sm lg:-right-7 lg:-top-1.5`}
          >
            No cloud
            <br />
            fees.
            <br />
            Ever.
          </div>
        </Snap>
      </div>
    </section>
  );
}
