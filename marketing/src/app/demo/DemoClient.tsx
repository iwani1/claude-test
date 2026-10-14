"use client";

import dynamic from "next/dynamic";
import { Component, type ReactNode } from "react";

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

/** If anything in the demo throws, say so on screen (with a way out) instead of going blank. */
class DemoBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  startOver = () => {
    try {
      sessionStorage.removeItem("lushview-demo-v1");
    } catch {
      /* ignore */
    }
    window.location.reload();
  };
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="grid min-h-dvh place-items-center bg-[#020c0a] p-6 text-emerald-50">
        <div className="max-w-md rounded-2xl border border-rose-400/30 bg-rose-400/10 p-5">
          <p className="font-semibold">The demo hit an error.</p>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs text-rose-100/80">{this.state.error.message}</pre>
          <button type="button" onClick={this.startOver} className="mt-4 rounded-xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-300">
            Start the shift over
          </button>
        </div>
      </div>
    );
  }
}

export function DemoClient() {
  return (
    <DemoBoundary>
      <DemoShell />
    </DemoBoundary>
  );
}
