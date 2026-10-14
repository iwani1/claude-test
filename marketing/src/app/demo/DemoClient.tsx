"use client";

import dynamic from "next/dynamic";
import { Component, type ReactNode } from "react";
import { KEY } from "@/demo/store";

/**
 * The demo keeps its state in localStorage, so it renders on the client only:
 * the static HTML carries this placeholder and the app takes over on load.
 */
const DemoShell = dynamic(() => import("@/demo/Shell").then((m) => m.DemoShell), {
  ssr: false,
  loading: () => (
    <div className="grid min-h-dvh place-items-center bg-[#fff6e6] text-[#16140f]" aria-busy="true">
      <div className="flex items-center gap-3 rounded-2xl bg-[#16140f] px-5 py-3 font-bold text-[#ffc233]">
        <span className="h-3 w-3 animate-pulse rounded-full bg-[#ffc233]" /> Opening the shift…
      </div>
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
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    window.location.reload();
  };
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="grid min-h-dvh place-items-center bg-[#fff6e6] p-6 text-[#16140f]">
        <div className="max-w-md rounded-[28px] border-[3px] border-[#16140f] bg-white p-7">
          <p className="text-2xl font-extrabold tracking-tight">The demo hit an error.</p>
          <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs text-[#8a8270]">{this.state.error.message}</pre>
          <button type="button" onClick={this.startOver} className="mt-6 h-12 rounded-2xl bg-[#ffc233] px-6 text-sm font-bold text-[#16140f] shadow-[0_4px_0_#e8a500]">
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
