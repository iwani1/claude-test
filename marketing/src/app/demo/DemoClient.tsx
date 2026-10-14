"use client";

import dynamic from "next/dynamic";

/**
 * The demo keeps its shift in sessionStorage, so it renders on the client only:
 * the static HTML carries this placeholder and the app takes over on load.
 */
const DemoShell = dynamic(() => import("@/demo/DemoShell").then((m) => m.DemoShell), {
  ssr: false,
  loading: () => (
    <div className="grid min-h-dvh place-items-center bg-[#020c0a] text-sm text-[#8fb3a6]" aria-busy="true">
      Opening the shift…
    </div>
  ),
});

export function DemoClient() {
  return <DemoShell />;
}
