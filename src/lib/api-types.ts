/**
 * Shared client-side DTO types (F7).
 *
 * The API returns Drizzle row shapes (with cost fields hidden per-role where
 * applicable); until this file existed the shell and screens typed those
 * payloads as `any`, so any API shape drift surfaced at runtime on a till
 * instead of at compile time. Types are imported with `import type` only —
 * nothing from the database schema module is bundled into browser code.
 */
import type { SessionUser } from "./auth";
import type {
  auditLogs,
  diningAreas,
  diningTables,
  ingredients,
  menuCategories,
  menuItems,
  orders,
  orderItems,
  payments,
  shifts,
  users,
} from "@/db/schema";

/** The user object the API hands to the browser (sessionVersion stripped). */
export type CurrentUser = Omit<SessionUser, "sessionVersion">;

export type MenuCategoryRow = typeof menuCategories.$inferSelect;
export type MenuItemRow = typeof menuItems.$inferSelect;
export type DiningAreaRow = typeof diningAreas.$inferSelect;
export type DiningTableRow = typeof diningTables.$inferSelect;
export type ShiftRow = typeof shifts.$inferSelect;
export type OrderRow = typeof orders.$inferSelect;
export type OrderItemRow = typeof orderItems.$inferSelect;
export type PaymentRow = typeof payments.$inferSelect;
export type IngredientRow = typeof ingredients.$inferSelect;
export type AuditLogRow = typeof auditLogs.$inferSelect;
export type StaffRow = Omit<typeof users.$inferSelect, "passwordHash" | "pin" | "pinLookup">;
