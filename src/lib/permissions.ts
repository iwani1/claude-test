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
  /** Hard-delete orders. Owner only: this erases the order and its whole
   *  financial trail, so it is deliberately not delegable to managers. */
  canDeleteOrders: boolean;
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
    canDeleteOrders: true,
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
    canDeleteOrders: false,
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
    canDeleteOrders: false,
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
    canDeleteOrders: false,
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
    canDeleteOrders: false,
  },
  accountant: {
    terminalAccess: true,
    label: "Accountant / Finance",
    canViewReports: true,
    canModifyInventory: false,
    canManageStaff: false,
    canIssueRefunds: false,
    canAccessPos: false,
    canAccessKds: false,
    canManageMenu: false,
    canManageSettings: false,
    canDeleteOrders: false,
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
