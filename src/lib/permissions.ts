export type UserRole = "super_admin" | "manager" | "cashier" | "cook" | "inventory_officer" | "accountant";
// Permissions Matrix
export const ROLE_PERMISSIONS: Record<UserRole, {
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
  /** Hard-delete orders. Owner only: this erases the order and its whole
   *  financial trail, so it is deliberately not delegable to managers. */
  canDeleteOrders: boolean;
  /** Re-price a saved order (items, discount, tip, customer). Owner only:
   *  changing what a guest was charged after the fact is an owner decision,
   *  and any balance it creates is settled against the drawer. */
  canEditOrders: boolean;
}> = {
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

/**
 * Message shown when a role without terminal access attempts to sign in.
 * Kept next to the permission matrix so the wording and the gate stay aligned.
 */
export const TERMINAL_ACCESS_DENIED_MESSAGE =
  "Kitchen staff do not sign in to this terminal. Kitchen orders are printed as paper dockets and delivered to the kitchen by front-of-house staff.";

/** True when the role is permitted to open an application session. */
export function hasTerminalAccess(role: UserRole): boolean {
  return ROLE_PERMISSIONS[role]?.terminalAccess === true;
}
