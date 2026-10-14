import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRight, Play } from "lucide-react";
import { brand, themes } from "@/content/site";
import { Reveal } from "@/components/shared/Reveal";

export const metadata: Metadata = { title: "Pick a UI" };

/** Miniature of each direction, drawn with CSS so the gallery needs no screenshots. */
function Thumb({ id }: { id: (typeof themes)[number]["id"] }) {
  if (id === "aurora")
    return (
      <div className="relative h-full w-full overflow-hidden bg-[#05010f]">
        <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-violet-600/60 blur-2xl" />
        <div className="absolute -right-6 top-4 h-32 w-32 rounded-full bg-cyan-400/50 blur-2xl" />
        <div className="absolute bottom-0 left-16 h-32 w-40 rounded-full bg-fuchsia-500/40 blur-2xl" />
        <div className="absolute inset-0 grid-lines mask-radial opacity-70" />
        <div className="absolute left-5 top-8 space-y-2">
          <div className="h-2 w-24 rounded bg-white/90" />
          <div className="h-2 w-16 rounded bg-white/60" />
          <div className="mt-3 h-4 w-14 rounded-md bg-white" />
        </div>
        <div className="absolute bottom-5 right-5 h-24 w-28 rounded-xl border border-white/20 bg-white/10 backdrop-blur-md [transform:rotateY(-14deg)_rotateX(6deg)]" />
      </div>
    );
  if (id === "grid")
    return (
      <div className="relative h-full w-full overflow-hidden bg-[#fafafa]">
        <div className="absolute inset-0 [background-image:linear-gradient(to_right,#e4e4e7_1px,transparent_1px),linear-gradient(to_bottom,#e4e4e7_1px,transparent_1px)] [background-size:16px_16px] mask-radial-top" />
        <div className="absolute left-1/2 top-6 -translate-x-1/2 space-y-2 text-center">
          <div className="mx-auto h-1.5 w-20 rounded-full border border-zinc-200 bg-white" />
          <div className="mx-auto h-2.5 w-32 rounded bg-zinc-900" />
          <div className="mx-auto h-2.5 w-24 rounded bg-emerald-600" />
          <div className="mx-auto mt-2 h-4 w-14 rounded-md bg-zinc-900" />
        </div>
        <div className="absolute bottom-4 left-4 right-4 grid grid-cols-3 gap-2">
          <div className="h-12 rounded-lg border border-emerald-400/60 bg-white" />
          <div className="h-12 rounded-lg border border-zinc-200 bg-white" />
          <div className="h-12 rounded-lg border border-zinc-200 bg-white" />
        </div>
      </div>
    );
  if (id === "orbs")
    return (
      <div className="relative h-full w-full overflow-hidden bg-[#020c0a]">
        <div className="absolute -left-12 -top-12 h-44 w-44 rounded-full bg-emerald-800/70 blur-2xl" />
        <div className="absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-amber-800/50 blur-2xl" />
        <svg className="absolute inset-0 h-full w-full opacity-70" viewBox="0 0 320 200" aria-hidden="true">
          {[[20, 40], [70, 90], [120, 30], [180, 70], [240, 40], [290, 110], [150, 150], [60, 160], [220, 160]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="1.8" fill="#6ee7b7" />
          ))}
          <path d="M20 40L70 90L120 30L180 70L240 40L290 110M70 90L60 160L150 150L220 160L290 110M180 70L150 150" stroke="#6ee7b7" strokeOpacity=".35" fill="none" />
        </svg>
        <div className="absolute left-1/2 top-9 -translate-x-1/2 space-y-2 text-center">
          <div className="mx-auto h-2.5 w-32 rounded bg-emerald-50" />
          <div className="mx-auto h-2.5 w-20 rounded bg-gradient-to-r from-emerald-300 to-amber-300" />
          <div className="mx-auto mt-2 h-4 w-14 rounded-full bg-emerald-400" />
        </div>
        <div className="absolute bottom-4 left-1/2 h-16 w-28 -translate-x-1/2 rounded-xl border border-emerald-100/15 bg-white/5 backdrop-blur-md" />
      </div>
    );
  return (
    <div className="relative h-full w-full overflow-hidden bg-[#f4efe6] dot-paper">
      <div className="h-3 w-full bg-[#111]" />
      <div className="absolute left-4 top-8 space-y-1.5">
        <div className="h-3.5 w-28 bg-[#111]" />
        <div className="h-3.5 w-20 bg-[#111]" />
        <div className="h-3.5 w-16 bg-[#ffd400] shadow-[3px_3px_0_#111]" />
        <div className="mt-3 h-5 w-16 bg-[#111] shadow-[3px_3px_0_#111]" />
      </div>
      <div className="absolute bottom-4 right-5 h-24 w-20 -rotate-3 border-[3px] border-[#111] bg-white shadow-[5px_5px_0_#111]" />
      <div className="absolute right-3 top-7 h-9 w-9 rotate-12 rounded-full border-[3px] border-[#111] bg-[#ff3d2e]" />
    </div>
  );
}

export default function Gallery() {
  return (
    <main className="mx-auto w-[min(1180px,100%-2.5rem)] py-10 md:py-16">
      <Reveal immediate className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[.18em] text-emerald-400">
            <img src={brand.logo} alt="" width={18} height={18} className="rounded" />
            {brand.name} · marketing site
          </p>
          <h1 className="mt-3 text-balance text-4xl font-bold tracking-tight md:text-5xl">Four UIs. One product. Pick the one you&apos;d ship.</h1>
          <p className="mt-3 max-w-2xl text-pretty text-zinc-400">
            Each card is a complete landing page — hero, features, how it works, pricing, FAQ — built in React, Tailwind and Motion from the
            same content file. Open one, scroll it, resize it; then press <kbd className="rounded border border-zinc-700 px-1 font-mono text-xs">1</kbd>–
            <kbd className="rounded border border-zinc-700 px-1 font-mono text-xs">4</kbd> to jump between them.
          </p>
        </div>
        <div className="flex flex-col items-start gap-3 sm:items-end">
          <Link
            href="/demo/"
            className="inline-flex items-center gap-2 rounded-full bg-emerald-400 px-5 py-2.5 text-sm font-semibold text-emerald-950 shadow-[0_10px_30px_-10px_rgba(52,211,153,.8)] transition-colors hover:bg-emerald-300"
          >
            <Play size={14} fill="currentColor" aria-hidden="true" /> Live product demo — the whole system
          </Link>
          <span className="text-sm text-zinc-500">Static export · no webfonts · no third-party scripts</span>
        </div>
      </Reveal>

      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        {themes.map((t, i) => (
          <Reveal key={t.id} immediate delay={0.08 * (i + 1)}>
            <Link
              href={`/${t.id}/`}
              className="group block overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60 transition-colors hover:border-zinc-600"
            >
              <div className="aspect-[16/10]">
                <Thumb id={t.id} />
              </div>
              <div className="flex items-start justify-between gap-4 p-5">
                <div>
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <span className="font-mono text-emerald-400">{t.n}</span>
                    <span>{t.mood}</span>
                    <span aria-hidden="true">·</span>
                    <span>after {t.modelledOn}</span>
                  </div>
                  <h2 className="mt-1 text-xl font-semibold tracking-tight">{t.name}</h2>
                  <p className="mt-1 text-sm text-zinc-400">{t.moves}</p>
                </div>
                <span className="mt-1 inline-flex shrink-0 items-center gap-1 rounded-full border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition-colors group-hover:border-emerald-400 group-hover:text-emerald-300">
                  Run demo <ArrowUpRight size={14} aria-hidden="true" />
                </span>
              </div>
              <div className="flex h-1.5">
                {t.swatch.map((c) => (
                  <span key={c} className="flex-1" style={{ background: c }} />
                ))}
              </div>
            </Link>
          </Reveal>
        ))}
      </div>

      <p className="mt-10 text-xs text-zinc-500">
        Static HTML prototypes of the four heroes, with the prompts that reproduce them, live in <code className="font-mono">ui-lab/</code>. The{" "}
        <Link href="/demo/" className="text-emerald-400 underline-offset-2 hover:underline">
          live demo
        </Link>{" "}
        is a simulated shift in the Orbs look — till, kitchen pass and cash drawer, with the real app&apos;s billing rules and no backend.
      </p>
    </main>
  );
}
