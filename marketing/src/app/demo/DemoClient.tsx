"use client";

import dynamic from "next/dynamic";
import { Component, type ReactNode } from "react";
import { KEY } from "@/demo/store";

/**
 * The demo keeps its shift in sessionStorage, so it renders on the client only:
 * the static HTML carries this placeholder and the app takes over on load.
 */
const DemoShell = dynamic(() => import("@/demo/DemoShell").then((m) => m.DemoShell), {
  ssr: false,
  loading: () => (
    <div className="grid min-h-dvh place-items-center bg-[#0a0d0c] font-serif text-xl italic text-[#9aa49f]" aria-busy="true">
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
      sessionStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    window.location.reload();
  };
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="grid min-h-dvh place-items-center bg-[#0a0d0c] p-6 text-[#e9eeea]">
        <div className="max-w-md border-t border-[#f0a05a] pt-5">
          <p className="font-serif text-2xl italic">The demo hit an error.</p>
          <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs text-[#9aa49f]">{this.state.error.message}</pre>
          <button type="button" onClick={this.startOver} className="mt-6 h-12 rounded-full bg-[#8cf0c6] px-6 text-sm font-semibold text-[#06251a] hover:-translate-y-px">
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
