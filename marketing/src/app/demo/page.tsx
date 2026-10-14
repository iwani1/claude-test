import type { Metadata } from "next";
import { DemoClient } from "./DemoClient";

export const metadata: Metadata = {
  title: "Live demo — Lush View POS",
  description: "Run a whole shift in the browser: take orders, work the kitchen pass, charge with Mobile Money or cash, sell through a network drop and audit the drawer.",
  robots: { index: false },
};

export default function DemoPage() {
  return <DemoClient />;
}
