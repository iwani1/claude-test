import { ChefHat, LayoutGrid, MonitorSmartphone, Package, Receipt, ShieldCheck, Wallet, WifiOff, type LucideProps } from "lucide-react";
import type { Feature } from "@/content/site";

const MAP = {
  wallet: Wallet,
  chef: ChefHat,
  package: Package,
  receipt: Receipt,
  wifi: WifiOff,
  devices: MonitorSmartphone,
  shield: ShieldCheck,
  table: LayoutGrid,
} satisfies Record<Feature["icon"], React.ComponentType<LucideProps>>;

export function FeatureIcon({ name, ...rest }: { name: Feature["icon"] } & LucideProps) {
  const C = MAP[name];
  return <C aria-hidden="true" {...rest} />;
}
