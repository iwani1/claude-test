"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { themes } from "@/content/site";

/**
 * Floating demo control: jump between the four UIs with a click or keys 1–4 / ← →.
 * `tone` lets each theme keep the pill readable on its own background.
 */
export function ThemeSwitcher({ tone = "dark" }: { tone?: "dark" | "light" | "ink" }) {
  const pathname = usePathname();
  const router = useRouter();
  const current = themes.findIndex((t) => pathname.startsWith(`/${t.id}`));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[1-4]$/.test(e.key)) router.push(`/${themes[Number(e.key) - 1].id}/`);
      else if (e.key === "ArrowRight" && current >= 0) router.push(`/${themes[(current + 1) % themes.length].id}/`);
      else if (e.key === "ArrowLeft" && current >= 0) router.push(`/${themes[(current - 1 + themes.length) % themes.length].id}/`);
      else if (e.key === "Escape") router.push("/");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, router]);

  const shell = {
    dark: "border-white/15 bg-black/60 text-white backdrop-blur-xl",
    light: "border-zinc-200 bg-white/85 text-zinc-900 shadow-lg shadow-black/5 backdrop-blur-xl",
    ink: "border-[3px] border-[#111] bg-[#f4efe6] text-[#111] hard-sm rounded-none",
  }[tone];
  const on = {
    dark: "bg-white text-black",
    light: "bg-zinc-900 text-white",
    ink: "bg-[#ffd400] text-[#111]",
  }[tone];
  const off = { dark: "text-white/70 hover:text-white", light: "text-zinc-500 hover:text-zinc-900", ink: "hover:bg-[#111] hover:text-[#ffd400]" }[tone];
  const radius = tone === "ink" ? "rounded-none" : "rounded-full";

  return (
    <nav
      aria-label="Switch UI direction"
      className={`fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 border p-1 text-xs font-semibold ${radius} ${shell}`}
    >
      <Link href="/" className={`${radius} px-2.5 py-1.5 ${off}`} title="All four (Esc)">
        ≡
      </Link>
      {themes.map((t, i) => (
        <Link
          key={t.id}
          href={`/${t.id}/`}
          aria-current={i === current ? "page" : undefined}
          className={`${radius} px-3 py-1.5 transition-colors ${i === current ? on : off}`}
          title={`${t.name} (${i + 1})`}
        >
          <span className="font-mono opacity-70">{t.n}</span>
          <span className="ml-1.5 hidden sm:inline">{t.name}</span>
        </Link>
      ))}
    </nav>
  );
}
