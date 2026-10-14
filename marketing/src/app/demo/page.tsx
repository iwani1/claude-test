import type { Metadata } from "next";
import { DemoClient } from "./DemoClient";

export const metadata: Metadata = {
  title: "Live demo — Lush View POS",
  description: "Run a whole shift in the browser: sign in with a PIN, take orders at the Till, work the kitchen pass, charge with cash or Mobile Money, count the drawer and read the reports.",
  robots: { index: false },
};

export default function DemoPage() {
  return <DemoClient />;
}
