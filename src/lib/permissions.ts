export type UserRole = "super_admin" | "manager" | "cashier" | "cook" | "inventory_officer" | "accountant";

export interface RolePermissionSet {
  label: string;
  /** Whether this role may sign in to a POS terminal at all. Kitchen staff
   *  work from printed dockets and have no application access. */
  terminalAccess: boolean;
  canViewReports: boolean;
  canModifyInventory: boolean;
  canManageStaff: boolean;
  canIssueRefunds: boolean;
  canAccessPos: boolean;
  canAccessKds: boolean;
  canManageMenu: boolean;
  canManageSettings: boolean;
  /** Read the order list and individual receipts. Deliberately separate from
   *  canAccessPos: finance roles read the transaction trail without gaining the
   *  till. The menu, the screen and the API gate must all ask this one question,
   *  because when they disagreed (menu said "can see reports", API said "till
   *  only") an accountant opened Order History onto a 403. */
  canViewOrderHistory: boolean;
  /** Read shift/drawer history. Operating the drawer — opening and closing a
   *  shift, cash drops, popping the till — stays behind canAccessPos. */
  canViewDrawerHistory: boolean;
  /** Read individual payments and refunds across the branch: the activity log
   *  and the accounting export. Reports access alone does not grant it, so an
   *  inventory officer who reads aggregate reports cannot see who paid what. */
  canViewTransactionTrail: boolean;
  /** Hard-delete orders. This erases the order and its whole financial
   *  trail, so no role below the owner has it by default; the owner may
   *  deliberately grant it to an individual user. */
  canDeleteOrders: boolean;
  /** Re-price a saved order (items, discount, tip, customer). Changing what
   *  a guest was charged after the fact is sensitive, so only the owner has
   *  it by default; the owner may deliberately grant it per user. */
  canEditOrders: boolean;
}

// Permissions Matrix
export const ROLE_PERMISSIONS: Record<UserRole, RolePermissionSet> = {
  super_admin: {
    label: "Super Admin / Owner",
    terminalAccess: true,
    canViewReports: true,
    canModifyInventory: true,
    canManageStaff: true,
    canIssueRefunds: true,
    canAccessPos: true,
    canAccessKds: true,
    canManageMenu: true,
    canManageSettings: true,
    canViewOrderHistory: true,
    canViewDrawerHistory: true,
    canViewTransactionTrail: true,
    canDeleteOrders: true,
    canEditOrders: true,
  },
  manager: {
    label: "Restaurant Manager",
    terminalAccess: true,
    canViewReports: true,
    canModifyInventory: true,
    canManageStaff: true,
    canIssueRefunds: true,
    canAccessPos: true,
    canAccessKds: true,
    canManageMenu: true,
    canManageSettings: false,
    canViewOrderHistory: true,
    canViewDrawerHistory: true,
    canViewTransactionTrail: true,
    canDeleteOrders: false,
    canEditOrders: false,
  },
  cashier: {
    label: "Cashier / Front-of-House",
    terminalAccess: true,
    canViewReports: false,
    canModifyInventory: false,
    canManageStaff: false,
    canIssueRefunds: false, // requires manager approval
    canAccessPos: true,
    // Front-of-house prints and delivers dockets, so they coordinate progress.
    canAccessKds: true,
    canManageMenu: false,
    canManageSettings: false,
    canViewOrderHistory: true,
    canViewDrawerHistory: true,
    canViewTransactionTrail: false,
    canDeleteOrders: false,
    canEditOrders: false,
  },
  cook: {
    label: "Kitchen Staff (No Terminal Access)",
    // The kitchen works purely from printed dockets - no application login.
    terminalAccess: false,
    canViewReports: false,
    canModifyInventory: false,
    canManageStaff: false,
    canIssueRefunds: false,
    canAccessPos: false,
    canAccessKds: false,
    canManageMenu: false,
    canManageSettings: false,
    canViewOrderHistory: false,
    canViewDrawerHistory: false,
    canViewTransactionTrail: false,
    canDeleteOrders: false,
    canEditOrders: false,
  },
  inventory_officer: {
    label: "Inventory Officer",
    terminalAccess: true,
    canViewReports: true,
    canModifyInventory: true,
    canManageStaff: false,
    canIssueRefunds: false,
    canAccessPos: false,
    canAccessKds: false,
    canManageMenu: true,
    canManageSettings: false,
    // Stock work, not money: reads reports and the menu/recipes, and does not
    // read the transaction trail or the drawer.
    canViewOrderHistory: false,
    canViewDrawerHistory: false,
    canViewTransactionTrail: false,
    canDeleteOrders: false,
    canEditOrders: false,
  },
  accountant: {
    terminalAccess: true,
    label: "Accountant / Finance",
    canViewReports: true,
    canModifyInventory: false,
    canManageStaff: false,
    // Finance may request refunds (owner directive, Oct 2026): the refund is
    // still authorised by a manager/owner PIN. For cash, the money comes out
    // of the requester's own open shift — or, since accountants cannot open
    // shifts, out of the approving manager's open shift.
    canIssueRefunds: true,
    canAccessPos: false,
    canAccessKds: false,
    canManageMenu: false,
    canManageSettings: false,
    // Finance reads the money trail — order history and the drawer ledger —
    // but never operates the till or the drawer (canAccessPos stays false).
    canViewOrderHistory: true,
    canViewDrawerHistory: true,
    canViewTransactionTrail: true,
    canDeleteOrders: false,
    canEditOrders: false,
  },
};

/** Every selectable permission, in the order the owner's picker shows them. */
export type PermissionKey = Exclude<keyof RolePermissionSet, "label">;

export type PermissionOverrides = Partial<Record<PermissionKey, boolean>>;

export interface PermissionDefinition {
  key: PermissionKey;
  group: string;
  label: string;
  description: string;
}

export const PERMISSION_DEFINITIONS: readonly PermissionDefinition[] = [
  { key: "terminalAccess", group: "Terminal & Till", label: "Terminal sign-in", description: "May sign in to the POS application at all." },
  { key: "canAccessPos", group: "Terminal & Till", label: "POS till & tables", description: "Take orders, open shifts, record payments and operate the drawer." },
  { key: "canAccessKds", group: "Terminal & Till", label: "Kitchen display", description: "See kitchen dockets and update their progress." },
  { key: "canViewDrawerHistory", group: "Terminal & Till", label: "Cash drawer history", description: "Read shift and drawer history. Operating the drawer still needs POS till access." },
  { key: "canViewOrderHistory", group: "Orders & Money", label: "Order history", description: "Read the order list and individual order details." },
  { key: "canIssueRefunds", group: "Orders & Money", label: "Request refunds", description: "Start a refund. A manager or owner PIN still authorises it." },
  { key: "canEditOrders", group: "Orders & Money", label: "Edit saved orders", description: "Re-price a saved order's items, discount or tip after the fact." },
  { key: "canDeleteOrders", group: "Orders & Money", label: "Delete orders", description: "Permanently delete an order and its financial trail. Sensitive." },
  { key: "canViewTransactionTrail", group: "Orders & Money", label: "Audit & transaction trail", description: "Read audit logs, individual payments and the accounting export." },
  { key: "canModifyInventory", group: "Stock & Menu", label: "Inventory & purchasing", description: "Change ingredient stock, recipes' stock, purchasing and goods received." },
  { key: "canManageMenu", group: "Stock & Menu", label: "Menu management", description: "Create and edit menu items, prices and recipes." },
  { key: "canViewReports", group: "Management", label: "Reports & dashboard", description: "Read financial reports and the owner dashboard." },
  { key: "canManageStaff", group: "Management", label: "Staff management", description: "View and manage staff accounts. Only the owner can change permissions." },
  { key: "canManageSettings", group: "Management", label: "Settings & integrations", description: "Change branch settings, hardware and tender configuration." },
];

export const PERMISSION_KEYS: readonly PermissionKey[] = PERMISSION_DEFINITIONS.map((d) => d.key);

/** Keep only known permission keys with boolean values from stored data. */
export function sanitizePermissionOverrides(value: unknown): PermissionOverrides {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const clean: PermissionOverrides = {};
  for (const key of PERMISSION_KEYS) {
    const entry = (value as Record<string, unknown>)[key];
    if (typeof entry === "boolean") clean[key] = entry;
  }
  return clean;
}

/**
 * The permissions a person actually has: their role's defaults with the
 * owner's per-user selections laid over the top. The owner (super_admin) is
 * always full-access — individual selections never apply, so an owner can
 * never be locked out by an edit.
 */
export function effectivePermissions(role: UserRole, overrides?: unknown): RolePermissionSet {
  const defaults = ROLE_PERMISSIONS[role] ?? ROLE_PERMISSIONS.cashier;
  if (role === "super_admin") return { ...defaults };
  return { ...defaults, ...sanitizePermissionOverrides(overrides) };
}

/** The stored overrides that make `selected` differ from the role defaults. */
export function permissionOverridesFor(role: UserRole, selected: Partial<Record<PermissionKey, boolean>>): PermissionOverrides {
  const defaults = ROLE_PERMISSIONS[role] ?? ROLE_PERMISSIONS.cashier;
  const overrides: PermissionOverrides = {};
  for (const key of PERMISSION_KEYS) {
    if (typeof selected[key] === "boolean" && selected[key] !== defaults[key]) overrides[key] = selected[key];
  }
  return overrides;
}

/**
 * Message shown when a role without terminal access attempts to sign in.
 * Kept next to the permission matrix so the wording and the gate stay aligned.
 */
export const TERMINAL_ACCESS_DENIED_MESSAGE =
  "Kitchen staff do not sign in to this terminal. Kitchen orders are printed as paper dockets and delivered to the kitchen by front-of-house staff.";

/** True when the person is permitted to open an application session. */
export function hasTerminalAccess(role: UserRole, overrides?: unknown): boolean {
  return effectivePermissions(role, overrides).terminalAccess === true;
}
