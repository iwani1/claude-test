import {
  LayoutDashboard,
  Calculator,
  Grid,
  ChefHat,
  Receipt,
  UtensilsCrossed,
  Scroll,
  Boxes,
  Truck,
  Coins,
  BarChart3,
  Users2,
  FileText,
  Sliders,
  Server,
  Cable,
} from "lucide-react";
import type { RolePermissionSet } from "@/lib/permissions";

export type NavTab =
  | "dashboard"
  | "pos"
  | "tables"
  | "kds"
  | "orders"
  | "menu"
  | "recipes"
  | "inventory"
  | "purchasing"
  | "shifts"
  | "reports"
  | "staff"
  | "audit"
  | "integrations"
  | "settings"
  | "deployment";

export type NavItem = {
  id: NavTab;
  label: string;
  icon: typeof Calculator;
  badge?: string | number;
  visible: boolean;
  /** Shortened label for the icon rail and the top bar. */
  short?: string;
};

export type NavSection = { title: string; items: NavItem[] };

/**
 * The one list of screens, shared by the classic sidebar and the new top bar
 * so the two can never disagree about who sees what. Each entry declares the
 * permission gate it sits behind; screens the signed-in person cannot use are
 * removed from navigation entirely, and the matching API routes are
 * independently guarded server-side (`npm run audit:workflows` checks that the
 * gates here match the APIs).
 */
export function buildNavSections(
  perms: RolePermissionSet,
  { openTableCount = 0, shiftOpen = false }: { openTableCount?: number; shiftOpen?: boolean } = {},
): NavSection[] {
  const allSections: NavSection[] = [
    {
      title: "TAKE ORDERS",
      items: [
        { id: "pos", label: "Take Order (Till)", short: "Order", icon: Calculator, visible: perms.canAccessPos },
        { id: "tables", label: "Tables", short: "Tables", icon: Grid, badge: openTableCount > 0 ? `${openTableCount} open` : undefined, visible: perms.canAccessPos },
        { id: "kds", label: "Kitchen", short: "Kitchen", icon: ChefHat, visible: perms.canAccessKds },
        { id: "orders", label: "Order History", short: "Orders", icon: Receipt, visible: perms.canViewOrderHistory },
      ],
    },
    {
      title: "CASH DRAWER",
      items: [
        { id: "shifts", label: "Cash Drawer", short: "Cash", icon: Coins, badge: shiftOpen ? "● Open" : "○ Closed", visible: perms.canViewDrawerHistory },
      ],
    },
    {
      title: "MENU & STOCK",
      items: [
        { id: "menu", label: "Menu Items", short: "Menu", icon: UtensilsCrossed, visible: perms.canManageMenu },
        { id: "recipes", label: "Recipes & Costing", short: "Recipes", icon: Scroll, visible: perms.canManageMenu },
        { id: "inventory", label: "Ingredient Stock", short: "Stock", icon: Boxes, visible: perms.canModifyInventory },
        { id: "purchasing", label: "Purchasing & GRN", short: "Buying", icon: Truck, visible: perms.canModifyInventory },
      ],
    },
    {
      title: "MANAGEMENT",
      items: [
        { id: "dashboard", label: "Owner Dashboard", short: "Dashboard", icon: LayoutDashboard, visible: perms.canViewReports },
        { id: "reports", label: "Reports & Analytics", short: "Reports", icon: BarChart3, visible: perms.canViewReports },
        { id: "staff", label: "Staff & Permissions", short: "Staff", icon: Users2, visible: perms.canManageStaff },
        { id: "audit", label: "Audit Logs", short: "Audit", icon: FileText, visible: perms.canViewTransactionTrail },
      ],
    },
    {
      title: "SYSTEM",
      items: [
        { id: "integrations", label: "Hardware & Tenders", short: "Hardware", icon: Cable, visible: perms.canManageSettings },
        { id: "settings", label: "Settings & Branch", short: "Settings", icon: Sliders, visible: perms.canManageSettings },
        { id: "deployment", label: "Hosting Deploy", short: "Deploy", icon: Server, badge: "Ready", visible: perms.canManageSettings },
      ],
    },
  ];

  return allSections
    .map((s) => ({ ...s, items: s.items.filter((i) => i.visible) }))
    .filter((s) => s.items.length > 0);
}
