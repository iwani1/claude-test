import { ROLE_PERMISSIONS } from "@/lib/permissions";

/**
 * Cost price and margin belong to whoever runs the menu or the books. Everyone
 * else, cashiers included, works from sale prices only. The same question is
 * asked wherever a menu item or an order line leaves the server.
 */
export function maySeeCost(user: { role: keyof typeof ROLE_PERMISSIONS } | null | undefined): boolean {
  if (!user) return false;
  const permissions = ROLE_PERMISSIONS[user.role];
  return !!permissions && (permissions.canViewReports || permissions.canManageMenu);
}

/** Removes the cost field from a row unless the caller may see it. */
export function hideCost<T extends { costPrice?: unknown }>(row: T, allowed: boolean): T {
  if (allowed) return row;
  const copy = { ...row };
  delete copy.costPrice;
  return copy;
}
