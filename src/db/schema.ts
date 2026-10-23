import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  serial,
  integer,
  numeric,
  timestamp,
  boolean,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

// ==========================================
// 1. Core Organization & Branch
// ==========================================
export const restaurants = pgTable("restaurants", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  legalName: text("legal_name"),
  currency: text("currency").default("GHS").notNull(),
  currencySymbol: text("currency_symbol").default("GH₵").notNull(),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  taxNumber: text("tax_number"),
  logoUrl: text("logo_url"),
  receiptHeader: text("receipt_header"),
  receiptFooter: text("receipt_footer"),
  defaultTaxRate: numeric("default_tax_rate", { precision: 5, scale: 2 }).default("8.25").notNull(),
  defaultServiceCharge: numeric("default_service_charge", { precision: 5, scale: 2 }).default("0.00").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const branches = pgTable("branches", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull(),
  name: text("name").notNull(),
  code: text("code").notNull(),
  address: text("address"),
  phone: text("phone"),
  managerName: text("manager_name"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ==========================================
// 2. Users, Employees & Authentication
// ==========================================
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull(),
  branchId: integer("branch_id").notNull().default(sql`nullif(current_setting('app.branch_id', true), '')::integer`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  sessionVersion: integer("session_version").notNull().default(0),
  pinLookup: text("pin_lookup"),
  pin: text("pin"), // 4-digit quick POS switch PIN
  role: text("role").notNull(), // 'super_admin' | 'manager' | 'cashier' | 'cook' | 'inventory_officer' | 'accountant'
  // Owner-selected per-user permission overrides (migration 0009): only the
  // keys that differ from the role's defaults are stored, as { key: boolean }.
  permissionOverrides: jsonb("permission_overrides").$type<Partial<Record<string, boolean>>>().notNull().default({}),
  avatarUrl: text("avatar_url"),
  phone: text("phone"),
  isActive: boolean("is_active").default(true).notNull(),
  lastLogin: timestamp("last_login"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ==========================================
// 3. Shifts & Cash Drawers
// ==========================================
export const shifts = pgTable("shifts", {
  id: serial("id").primaryKey(),
  branchId: integer("branch_id").notNull().default(sql`nullif(current_setting('app.branch_id', true), '')::integer`),
  userId: integer("user_id").notNull(),
  openedAt: timestamp("opened_at").defaultNow().notNull(),
  closedAt: timestamp("closed_at"),
  openingCash: numeric("opening_cash", { precision: 10, scale: 2 }).notNull(),
  expectedClosingCash: numeric("expected_closing_cash", { precision: 10, scale: 2 }),
  actualClosingCash: numeric("actual_closing_cash", { precision: 10, scale: 2 }),
  cashDifference: numeric("cash_difference", { precision: 10, scale: 2 }),
  totalSales: numeric("total_sales", { precision: 10, scale: 2 }).default("0.00"),
  totalCashSales: numeric("total_cash_sales", { precision: 10, scale: 2 }).default("0.00"),
  totalCardSales: numeric("total_card_sales", { precision: 10, scale: 2 }).default("0.00"),
  cashPayouts: numeric("cash_payouts", { precision: 10, scale: 2 }).default("0.00"),
  status: text("status").default("open").notNull(), // 'open' | 'closed'
  notes: text("notes"),
  reconciledBy: integer("reconciled_by"),
});

// ==========================================
// 4. Dining Areas & Tables
// ==========================================
export const diningAreas = pgTable("dining_areas", {
  id: serial("id").primaryKey(),
  branchId: integer("branch_id").notNull().default(sql`nullif(current_setting('app.branch_id', true), '')::integer`),
  name: text("name").notNull(), // e.g. "Main Dining", "Patio", "Bar", "VIP Lounge"
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true).notNull(),
});

export const diningTables = pgTable("dining_tables", {
  id: serial("id").primaryKey(),
  areaId: integer("area_id").notNull(),
  branchId: integer("branch_id").notNull().default(sql`nullif(current_setting('app.branch_id', true), '')::integer`),
  tableNumber: text("table_number").notNull(), // e.g. "T-01", "Bar-3"
  capacity: integer("capacity").default(4).notNull(),
  status: text("status").default("available").notNull(), // 'available' | 'occupied' | 'reserved' | 'cleaning'
  currentOrderId: integer("current_order_id"),
  posX: integer("pos_x").default(0),
  posY: integer("pos_y").default(0),
  shape: text("shape").default("square"), // 'square' | 'circle' | 'rectangle'
  isActive: boolean("is_active").default(true).notNull(),
});

// ==========================================
// 5. Menu Categories & Items
// ==========================================
export const menuCategories = pgTable("menu_categories", {
  id: serial("id").primaryKey(),
  branchId: integer("branch_id").notNull().default(sql`nullif(current_setting('app.branch_id', true), '')::integer`),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  icon: text("icon"),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true).notNull(),
});

export const menuItems = pgTable("menu_items", {
  id: serial("id").primaryKey(),
  branchId: integer("branch_id").notNull().default(sql`nullif(current_setting('app.branch_id', true), '')::integer`),
  categoryId: integer("category_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  sku: text("sku"),
  barcode: text("barcode"),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  costPrice: numeric("cost_price", { precision: 10, scale: 2 }).default("0.00"),
  imageUrl: text("image_url"),
  prepTimeMinutes: integer("prep_time_minutes").default(15),
  station: text("station").default("kitchen"), // 'kitchen' | 'bar' | 'grill' | 'dessert'
  isAvailable: boolean("is_available").default(true).notNull(),
  // Deleted-from-menu marker (0010): the row survives for sales history and
  // reports, but menu endpoints stop returning it. Distinct from
  // isAvailable, which is the reversible daily 86.
  isArchived: boolean("is_archived").default(false).notNull(),
  isFeatured: boolean("is_featured").default(false),
  taxRate: numeric("tax_rate", { precision: 5, scale: 2 }).default("8.25"),
  hasRecipe: boolean("has_recipe").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const modifiers = pgTable("modifiers", {
  id: serial("id").primaryKey(),
  branchId: integer("branch_id").notNull().default(sql`nullif(current_setting('app.branch_id', true), '')::integer`),
  name: text("name").notNull(), // e.g., "Meat Doneness", "Cheese Selection", "Add-ons", "Spice Level"
  minSelection: integer("min_selection").default(0),
  maxSelection: integer("max_selection").default(1),
  isRequired: boolean("is_required").default(false),
});

export const modifierOptions = pgTable("modifier_options", {
  id: serial("id").primaryKey(),
  branchId: integer("branch_id").notNull().default(sql`nullif(current_setting('app.branch_id', true), '')::integer`),
  modifierId: integer("modifier_id").notNull(),
  name: text("name").notNull(), // e.g., "Medium Rare", "Extra Cheddar (+$1.50)"
  priceDelta: numeric("price_delta", { precision: 10, scale: 2 }).default("0.00").notNull(),
  sortOrder: integer("sort_order").default(0),
});

export const menuItemModifiers = pgTable("menu_item_modifiers", {
  id: serial("id").primaryKey(),
  branchId: integer("branch_id").notNull().default(sql`nullif(current_setting('app.branch_id', true), '')::integer`),
  menuItemId: integer("menu_item_id").notNull(),
  modifierId: integer("modifier_id").notNull(),
});

// ==========================================
// 6. Ingredients, Recipes & Inventory
// ==========================================
export const ingredients = pgTable("ingredients", {
  id: serial("id").primaryKey(),
  branchId: integer("branch_id").notNull().default(sql`nullif(current_setting('app.branch_id', true), '')::integer`),
  name: text("name").notNull(),
  sku: text("sku"),
  category: text("category").default("general"), // 'produce' | 'meat' | 'dairy' | 'dry_goods' | 'beverage' | 'packaging'
  currentStock: numeric("current_stock", { precision: 12, scale: 3 }).default("0.000").notNull(),
  minStockLevel: numeric("min_stock_level", { precision: 12, scale: 3 }).default("10.000").notNull(),
  unit: text("unit").notNull(), // 'kg', 'g', 'liter', 'ml', 'pcs', 'bottle', 'box'
  costPerUnit: numeric("cost_per_unit", { precision: 10, scale: 2 }).default("0.00").notNull(),
  supplierId: integer("supplier_id"),
  location: text("location").default("Main Walk-in Fridge"),
  imageUrl: text("image_url"),
  isActive: boolean("is_active").default(true).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const recipes = pgTable("recipes", {
  id: serial("id").primaryKey(),
  branchId: integer("branch_id").notNull().default(sql`nullif(current_setting('app.branch_id', true), '')::integer`),
  menuItemId: integer("menu_item_id").notNull().unique(),
  yieldCount: integer("yield_count").default(1).notNull(),
  prepInstructions: text("prep_instructions"),
  totalRecipeCost: numeric("total_recipe_cost", { precision: 10, scale: 2 }).default("0.00"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const recipeIngredients = pgTable("recipe_ingredients", {
  id: serial("id").primaryKey(),
  branchId: integer("branch_id").notNull().default(sql`nullif(current_setting('app.branch_id', true), '')::integer`),
  recipeId: integer("recipe_id").notNull(),
  ingredientId: integer("ingredient_id").notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull(),
  unit: text("unit").notNull(),
  costPortion: numeric("cost_portion", { precision: 10, scale: 2 }).default("0.00"),
});

export const stockMovements = pgTable("stock_movements", {
  id: serial("id").primaryKey(),
  branchId: integer("branch_id").notNull().default(sql`nullif(current_setting('app.branch_id', true), '')::integer`),
  ingredientId: integer("ingredient_id").notNull(),
  movementType: text("movement_type").notNull(), // 'purchase_receipt' | 'order_deduction' | 'waste_spoilage' | 'adjustment' | 'return'
  quantityDelta: numeric("quantity_delta", { precision: 12, scale: 3 }).notNull(), // positive for in, negative for out
  previousStock: numeric("previous_stock", { precision: 12, scale: 3 }).notNull(),
  newStock: numeric("new_stock", { precision: 12, scale: 3 }).notNull(),
  referenceId: text("reference_id"), // order number, PO number, or waste ticket ID
  unitCost: numeric("unit_cost", { precision: 10, scale: 2 }),
  reason: text("reason"),
  createdById: integer("created_by_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("stock_movements_branch_created_idx").on(table.branchId, table.createdAt.desc(), table.id.desc()),
  // Order stock reversal looks movements up by order-number reference.
  index("stock_movements_branch_reference_idx").on(table.branchId, table.referenceId),
]);

export const stockCounts = pgTable("stock_counts", {
  id: serial("id").primaryKey(),
  branchId: integer("branch_id").notNull().default(sql`nullif(current_setting('app.branch_id', true), '')::integer`),
  countDate: timestamp("count_date").defaultNow().notNull(),
  conductedBy: integer("conducted_by").notNull(),
  notes: text("notes"),
  status: text("status").default("completed").notNull(), // 'in_progress' | 'completed' | 'reconciled'
  items: jsonb("items").notNull(), // array of { ingredientId, systemStock, physicalStock, diff, costDiff }
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ==========================================
// 7. Suppliers & Purchase Orders
// ==========================================
export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  branchId: integer("branch_id").notNull().default(sql`nullif(current_setting('app.branch_id', true), '')::integer`),
  name: text("name").notNull(),
  contactPerson: text("contact_person"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  paymentTerms: text("payment_terms").default("Net 30"),
  leadTimeDays: integer("lead_time_days").default(3),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const purchaseOrders = pgTable("purchase_orders", {
  id: serial("id").primaryKey(),
  poNumber: text("po_number").notNull().unique(), // e.g. "PO-20261013-3F9A2C1B"
  supplierId: integer("supplier_id").notNull(),
  branchId: integer("branch_id").notNull().default(sql`nullif(current_setting('app.branch_id', true), '')::integer`),
  createdById: integer("created_by_id").notNull(),
  status: text("status").default("ordered").notNull(), // 'draft' | 'ordered' | 'partially_received' | 'received' | 'cancelled'
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).default("0.00").notNull(),
  tax: numeric("tax", { precision: 10, scale: 2 }).default("0.00").notNull(),
  total: numeric("total", { precision: 10, scale: 2 }).default("0.00").notNull(),
  expectedDeliveryDate: timestamp("expected_delivery_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  receivedAt: timestamp("received_at"),
});

export const purchaseOrderItems = pgTable("purchase_order_items", {
  id: serial("id").primaryKey(),
  branchId: integer("branch_id").notNull().default(sql`nullif(current_setting('app.branch_id', true), '')::integer`),
  purchaseOrderId: integer("purchase_order_id").notNull(),
  ingredientId: integer("ingredient_id").notNull(),
  orderedQuantity: numeric("ordered_quantity", { precision: 12, scale: 3 }).notNull(),
  receivedQuantity: numeric("received_quantity", { precision: 12, scale: 3 }).default("0.000"),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: numeric("total_price", { precision: 10, scale: 2 }).notNull(),
  unit: text("unit").notNull(),
});

export const goodsReceipts = pgTable("goods_receipts", {
  id: serial("id").primaryKey(),
  branchId: integer("branch_id").notNull().default(sql`nullif(current_setting('app.branch_id', true), '')::integer`),
  grnNumber: text("grn_number").notNull().unique(),
  purchaseOrderId: integer("purchase_order_id").notNull(),
  receivedBy: integer("received_by").notNull(),
  invoiceNumber: text("invoice_number"),
  receivedAt: timestamp("received_at").defaultNow().notNull(),
  notes: text("notes"),
  itemsReceived: jsonb("items_received").notNull(),
});

// ==========================================
// 8. Orders, Order Items & Kitchen Tickets
// ==========================================
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderNumber: text("order_number").notNull().unique(), // e.g. "ORD-1042"
  branchId: integer("branch_id").notNull().default(sql`nullif(current_setting('app.branch_id', true), '')::integer`),
  tableId: integer("table_id"),
  /** Hotel room number for room-service orders; null for restaurant floor orders. */
  roomNumber: text("room_number"),
  userId: integer("user_id").notNull(), // employee/cashier ID
  customerName: text("customer_name").default("Walk-in Guest"),
  customerPhone: text("customer_phone"),
  orderType: text("order_type").default("dine_in").notNull(), // 'dine_in' | 'takeaway' | 'delivery'
  status: text("status").default("draft").notNull(), // 'draft' | 'confirmed' | 'preparing' | 'ready' | 'served' | 'completed' | 'cancelled' | 'refunded'
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).default("0.00").notNull(),
  taxAmount: numeric("tax_amount", { precision: 10, scale: 2 }).default("0.00").notNull(),
  serviceCharge: numeric("service_charge", { precision: 10, scale: 2 }).default("0.00").notNull(),
  // Flat charge added when the guest eats in the room (dine-in). The amount is
  // configurable in application_settings so it can be changed later without a
  // code deploy. Kept separate from serviceCharge so the two never conflate.
  roomCharge: numeric("room_charge", { precision: 10, scale: 2 }).default("0.00").notNull(),
  discountAmount: numeric("discount_amount", { precision: 10, scale: 2 }).default("0.00").notNull(),
  discountReason: text("discount_reason"),
  tipAmount: numeric("tip_amount", { precision: 10, scale: 2 }).default("0.00").notNull(),
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).default("0.00").notNull(),
  // Complimentary breakfast: food served free to a room guest. The order still
  // deducts stock and prints a kitchen docket, but total is GH₵0.00.
  isComplimentary: boolean("is_complimentary").default(false).notNull(),
  complimentaryReason: text("complimentary_reason"),
  /** Retail value of the free food, retained for management reporting. */
  compValue: numeric("comp_value", { precision: 10, scale: 2 }).default("0.00").notNull(),
  /** Who authorised the complimentary order (auditable). */
  complimentaryApprovedBy: integer("complimentary_approved_by"),
  paidAmount: numeric("paid_amount", { precision: 10, scale: 2 }).default("0.00").notNull(),
  paymentStatus: text("payment_status").default("unpaid").notNull(), // 'unpaid' | 'partially_paid' | 'paid' | 'refunded'
  notes: text("notes"),
  idempotencyKey: text("idempotency_key"),
  requestFingerprint: text("request_fingerprint"),
  stockDeducted: boolean("stock_deducted").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  // Hot path: branch-scoped (RLS) history/report lists sorted newest-first.
  index("orders_branch_created_idx").on(table.branchId, table.createdAt.desc(), table.id.desc()),
]);

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  branchId: integer("branch_id").notNull().default(sql`nullif(current_setting('app.branch_id', true), '')::integer`),
  orderId: integer("order_id").notNull(),
  menuItemId: integer("menu_item_id").notNull(),
  itemName: text("item_name").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: numeric("total_price", { precision: 10, scale: 2 }).notNull(),
  costPrice: numeric("cost_price", { precision: 10, scale: 2 }).default("0.00"),
  modifiers: jsonb("modifiers").default([]), // array of { modifierName, optionName, priceDelta }
  specialInstructions: text("special_instructions"),
  itemStatus: text("item_status").default("pending").notNull(), // 'pending' | 'preparing' | 'ready' | 'served' | 'cancelled'
  station: text("station").default("kitchen").notNull(), // 'kitchen' | 'bar' | 'grill'
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("order_items_branch_order_idx").on(table.branchId, table.orderId),
]);

export const kitchenTickets = pgTable("kitchen_tickets", {
  id: serial("id").primaryKey(),
  branchId: integer("branch_id").notNull().default(sql`nullif(current_setting('app.branch_id', true), '')::integer`),
  orderId: integer("order_id").notNull(),
  ticketNumber: text("ticket_number").notNull(), // e.g. "K-1042"
  station: text("station").default("kitchen").notNull(), // 'kitchen' | 'bar' | 'grill'
  status: text("status").default("pending").notNull(), // 'pending' | 'preparing' | 'ready' | 'completed'
  items: jsonb("items").notNull(),
  startedAt: timestamp("started_at"),
  readyAt: timestamp("ready_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("kitchen_tickets_branch_order_idx").on(table.branchId, table.orderId),
]);

// ==========================================
// 9. Payments & Refunds
// ==========================================
export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  branchId: integer("branch_id").notNull().default(sql`nullif(current_setting('app.branch_id', true), '')::integer`),
  orderId: integer("order_id").notNull(),
  shiftId: integer("shift_id"),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: text("payment_method").notNull(), // 'cash' | 'card' | 'stripe' | 'other'
  referenceNumber: text("reference_number"),
  cashTendered: numeric("cash_tendered", { precision: 10, scale: 2 }),
  changeGiven: numeric("change_given", { precision: 10, scale: 2 }),
  status: text("status").default("completed").notNull(), // 'completed' | 'failed' | 'refunded'
  /** Stable retry key: a lost response must replay, not take the money twice. */
  idempotencyKey: text("idempotency_key"),
  /** A reused key with a different amount is rejected, never replayed. */
  requestFingerprint: text("request_fingerprint"),
  processedBy: integer("processed_by").notNull(),
  gatewayResponse: jsonb("gateway_response"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("payments_branch_created_idx").on(table.branchId, table.createdAt.desc(), table.id.desc()),
  index("payments_branch_order_idx").on(table.branchId, table.orderId),
  index("payments_branch_shift_idx").on(table.branchId, table.shiftId),
]);

export const refunds = pgTable("refunds", {
  id: serial("id").primaryKey(),
  branchId: integer("branch_id").notNull().default(sql`nullif(current_setting('app.branch_id', true), '')::integer`),
  orderId: integer("order_id").notNull(),
  paymentId: integer("payment_id"),
  cashAmount: numeric("cash_amount", { precision: 10, scale: 2 }),
  momoAmount: numeric("momo_amount", { precision: 10, scale: 2 }),
  shiftId: integer("shift_id"),
  idempotencyKey: text("idempotency_key"),
  requestFingerprint: text("request_fingerprint"),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  reason: text("reason").notNull(),
  authorizedBy: integer("authorized_by").notNull(),
  stockReturned: boolean("stock_returned").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("refunds_branch_created_idx").on(table.branchId, table.createdAt.desc(), table.id.desc()),
  index("refunds_branch_order_idx").on(table.branchId, table.orderId),
]);

// ==========================================
// 10. Audit Logs & System Settings
// ==========================================
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  branchId: integer("branch_id").notNull().default(sql`nullif(current_setting('app.branch_id', true), '')::integer`),
  userId: integer("user_id"),
  userName: text("user_name"),
  action: text("action").notNull(), // e.g. 'order_created', 'item_voided', 'refund_issued', 'stock_adjusted', 'user_login'
  entityType: text("entity_type").notNull(), // 'order' | 'inventory' | 'user' | 'shift' | 'system'
  entityId: text("entity_id"),
  details: text("details"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("audit_logs_branch_created_idx").on(table.branchId, table.createdAt.desc(), table.id.desc()),
]);

export const applicationSettings = pgTable("application_settings", {
  id: serial("id").primaryKey(),
  branchId: integer("branch_id").notNull().default(sql`nullif(current_setting('app.branch_id', true), '')::integer`),
  key: text("key").notNull(),
  value: text("value").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Positive drawer outflows; refund links are unique and enforced in SQL migration.
export const drawerMovements = pgTable("drawer_movements", {
  id: serial("id").primaryKey(),
  branchId: integer("branch_id").notNull().default(sql`nullif(current_setting('app.branch_id', true), '')::integer`),
  shiftId: integer("shift_id").notNull(),
  refundId: integer("refund_id"),
  kind: text("kind").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  reason: text("reason").notNull(),
  createdBy: integer("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("drawer_movements_branch_shift_idx").on(table.branchId, table.shiftId),
]);

// ==========================================
// 11. Order deletion tombstones (F3)
// ==========================================
// Minimal, permanent evidence that an order was erased: order number, the
// money it held, who erased it and when. Written in the same transaction as
// the deletion (src/app/api/orders/[id]/route.ts), never exposed by any API,
// and never deleted by the application. Deliberately NO foreign key to
// orders — one would either block erasure or cascade the evidence away.
export const orderDeletionTombstones = pgTable("order_deletion_tombstones", {
  id: serial("id").primaryKey(),
  branchId: integer("branch_id").notNull().default(sql`nullif(current_setting('app.branch_id', true), '')::integer`),
  orderId: integer("order_id").notNull(),
  orderNumber: text("order_number").notNull(),
  orderType: text("order_type"),
  status: text("status"),
  paymentStatus: text("payment_status"),
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull(),
  paidAmount: numeric("paid_amount", { precision: 10, scale: 2 }).notNull(),
  refundedAmount: numeric("refunded_amount", { precision: 10, scale: 2 }).default("0.00").notNull(),
  createdByUserId: integer("created_by_user_id"),
  deletedBy: integer("deleted_by").notNull(),
  deletedByName: text("deleted_by_name"),
  orderCreatedAt: timestamp("order_created_at").notNull(),
  deletedAt: timestamp("deleted_at").defaultNow().notNull(),
  reason: text("reason"),
}, (table) => [
  index("order_deletion_tombstones_branch_deleted_idx").on(table.branchId, table.deletedAt.desc()),
]);
