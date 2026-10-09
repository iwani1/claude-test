CREATE TABLE "application_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"branch_id" integer DEFAULT nullif(current_setting('app.branch_id', true), '')::integer NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"description" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"branch_id" integer DEFAULT nullif(current_setting('app.branch_id', true), '')::integer NOT NULL,
	"user_id" integer,
	"user_name" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"details" text,
	"ip_address" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "branches" (
	"id" serial PRIMARY KEY NOT NULL,
	"restaurant_id" integer NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"address" text,
	"phone" text,
	"manager_name" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dining_areas" (
	"id" serial PRIMARY KEY NOT NULL,
	"branch_id" integer DEFAULT nullif(current_setting('app.branch_id', true), '')::integer NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dining_tables" (
	"id" serial PRIMARY KEY NOT NULL,
	"area_id" integer NOT NULL,
	"branch_id" integer DEFAULT nullif(current_setting('app.branch_id', true), '')::integer NOT NULL,
	"table_number" text NOT NULL,
	"capacity" integer DEFAULT 4 NOT NULL,
	"status" text DEFAULT 'available' NOT NULL,
	"current_order_id" integer,
	"pos_x" integer DEFAULT 0,
	"pos_y" integer DEFAULT 0,
	"shape" text DEFAULT 'square',
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goods_receipts" (
	"id" serial PRIMARY KEY NOT NULL,
	"branch_id" integer DEFAULT nullif(current_setting('app.branch_id', true), '')::integer NOT NULL,
	"grn_number" text NOT NULL,
	"purchase_order_id" integer NOT NULL,
	"received_by" integer NOT NULL,
	"invoice_number" text,
	"received_at" timestamp DEFAULT now() NOT NULL,
	"notes" text,
	"items_received" jsonb NOT NULL,
	CONSTRAINT "goods_receipts_grn_number_unique" UNIQUE("grn_number")
);
--> statement-breakpoint
CREATE TABLE "ingredients" (
	"id" serial PRIMARY KEY NOT NULL,
	"branch_id" integer DEFAULT nullif(current_setting('app.branch_id', true), '')::integer NOT NULL,
	"name" text NOT NULL,
	"sku" text,
	"category" text DEFAULT 'general',
	"current_stock" numeric(12, 3) DEFAULT '0.000' NOT NULL,
	"min_stock_level" numeric(12, 3) DEFAULT '10.000' NOT NULL,
	"unit" text NOT NULL,
	"cost_per_unit" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"supplier_id" integer,
	"location" text DEFAULT 'Main Walk-in Fridge',
	"image_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kitchen_tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"branch_id" integer DEFAULT nullif(current_setting('app.branch_id', true), '')::integer NOT NULL,
	"order_id" integer NOT NULL,
	"ticket_number" text NOT NULL,
	"station" text DEFAULT 'kitchen' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"items" jsonb NOT NULL,
	"started_at" timestamp,
	"ready_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"branch_id" integer DEFAULT nullif(current_setting('app.branch_id', true), '')::integer NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"icon" text,
	"sort_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_item_modifiers" (
	"id" serial PRIMARY KEY NOT NULL,
	"branch_id" integer DEFAULT nullif(current_setting('app.branch_id', true), '')::integer NOT NULL,
	"menu_item_id" integer NOT NULL,
	"modifier_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"branch_id" integer DEFAULT nullif(current_setting('app.branch_id', true), '')::integer NOT NULL,
	"category_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"sku" text,
	"barcode" text,
	"price" numeric(10, 2) NOT NULL,
	"cost_price" numeric(10, 2) DEFAULT '0.00',
	"image_url" text,
	"prep_time_minutes" integer DEFAULT 15,
	"station" text DEFAULT 'kitchen',
	"is_available" boolean DEFAULT true NOT NULL,
	"is_featured" boolean DEFAULT false,
	"tax_rate" numeric(5, 2) DEFAULT '8.25',
	"has_recipe" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modifier_options" (
	"id" serial PRIMARY KEY NOT NULL,
	"branch_id" integer DEFAULT nullif(current_setting('app.branch_id', true), '')::integer NOT NULL,
	"modifier_id" integer NOT NULL,
	"name" text NOT NULL,
	"price_delta" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"sort_order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "modifiers" (
	"id" serial PRIMARY KEY NOT NULL,
	"branch_id" integer DEFAULT nullif(current_setting('app.branch_id', true), '')::integer NOT NULL,
	"name" text NOT NULL,
	"min_selection" integer DEFAULT 0,
	"max_selection" integer DEFAULT 1,
	"is_required" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"branch_id" integer DEFAULT nullif(current_setting('app.branch_id', true), '')::integer NOT NULL,
	"order_id" integer NOT NULL,
	"menu_item_id" integer NOT NULL,
	"item_name" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"total_price" numeric(10, 2) NOT NULL,
	"cost_price" numeric(10, 2) DEFAULT '0.00',
	"modifiers" jsonb DEFAULT '[]'::jsonb,
	"special_instructions" text,
	"item_status" text DEFAULT 'pending' NOT NULL,
	"station" text DEFAULT 'kitchen' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_number" text NOT NULL,
	"branch_id" integer DEFAULT nullif(current_setting('app.branch_id', true), '')::integer NOT NULL,
	"table_id" integer,
	"room_number" text,
	"user_id" integer NOT NULL,
	"customer_name" text DEFAULT 'Walk-in Guest',
	"customer_phone" text,
	"order_type" text DEFAULT 'dine_in' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"subtotal" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"tax_amount" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"service_charge" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"room_charge" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"discount_amount" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"discount_reason" text,
	"tip_amount" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"total_amount" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"is_complimentary" boolean DEFAULT false NOT NULL,
	"complimentary_reason" text,
	"comp_value" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"complimentary_approved_by" integer,
	"paid_amount" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"payment_status" text DEFAULT 'unpaid' NOT NULL,
	"notes" text,
	"idempotency_key" text,
	"stock_deducted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "orders_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"branch_id" integer DEFAULT nullif(current_setting('app.branch_id', true), '')::integer NOT NULL,
	"order_id" integer NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"payment_method" text NOT NULL,
	"reference_number" text,
	"cash_tendered" numeric(10, 2),
	"change_given" numeric(10, 2),
	"status" text DEFAULT 'completed' NOT NULL,
	"processed_by" integer NOT NULL,
	"gateway_response" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"branch_id" integer DEFAULT nullif(current_setting('app.branch_id', true), '')::integer NOT NULL,
	"purchase_order_id" integer NOT NULL,
	"ingredient_id" integer NOT NULL,
	"ordered_quantity" numeric(12, 3) NOT NULL,
	"received_quantity" numeric(12, 3) DEFAULT '0.000',
	"unit_price" numeric(10, 2) NOT NULL,
	"total_price" numeric(10, 2) NOT NULL,
	"unit" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"po_number" text NOT NULL,
	"supplier_id" integer NOT NULL,
	"branch_id" integer DEFAULT nullif(current_setting('app.branch_id', true), '')::integer NOT NULL,
	"created_by_id" integer NOT NULL,
	"status" text DEFAULT 'ordered' NOT NULL,
	"subtotal" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"tax" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"total" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"expected_delivery_date" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"received_at" timestamp,
	CONSTRAINT "purchase_orders_po_number_unique" UNIQUE("po_number")
);
--> statement-breakpoint
CREATE TABLE "recipe_ingredients" (
	"id" serial PRIMARY KEY NOT NULL,
	"branch_id" integer DEFAULT nullif(current_setting('app.branch_id', true), '')::integer NOT NULL,
	"recipe_id" integer NOT NULL,
	"ingredient_id" integer NOT NULL,
	"quantity" numeric(12, 3) NOT NULL,
	"unit" text NOT NULL,
	"cost_portion" numeric(10, 2) DEFAULT '0.00'
);
--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" serial PRIMARY KEY NOT NULL,
	"branch_id" integer DEFAULT nullif(current_setting('app.branch_id', true), '')::integer NOT NULL,
	"menu_item_id" integer NOT NULL,
	"yield_count" integer DEFAULT 1 NOT NULL,
	"prep_instructions" text,
	"total_recipe_cost" numeric(10, 2) DEFAULT '0.00',
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "recipes_menu_item_id_unique" UNIQUE("menu_item_id")
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" serial PRIMARY KEY NOT NULL,
	"branch_id" integer DEFAULT nullif(current_setting('app.branch_id', true), '')::integer NOT NULL,
	"order_id" integer NOT NULL,
	"payment_id" integer,
	"amount" numeric(10, 2) NOT NULL,
	"reason" text NOT NULL,
	"authorized_by" integer NOT NULL,
	"stock_returned" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "restaurants" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"legal_name" text,
	"currency" text DEFAULT 'USD' NOT NULL,
	"currency_symbol" text DEFAULT '$' NOT NULL,
	"phone" text,
	"email" text,
	"address" text,
	"tax_number" text,
	"logo_url" text,
	"receipt_header" text,
	"receipt_footer" text,
	"default_tax_rate" numeric(5, 2) DEFAULT '8.25' NOT NULL,
	"default_service_charge" numeric(5, 2) DEFAULT '0.00' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shifts" (
	"id" serial PRIMARY KEY NOT NULL,
	"branch_id" integer DEFAULT nullif(current_setting('app.branch_id', true), '')::integer NOT NULL,
	"user_id" integer NOT NULL,
	"opened_at" timestamp DEFAULT now() NOT NULL,
	"closed_at" timestamp,
	"opening_cash" numeric(10, 2) NOT NULL,
	"expected_closing_cash" numeric(10, 2),
	"actual_closing_cash" numeric(10, 2),
	"cash_difference" numeric(10, 2),
	"total_sales" numeric(10, 2) DEFAULT '0.00',
	"total_cash_sales" numeric(10, 2) DEFAULT '0.00',
	"total_card_sales" numeric(10, 2) DEFAULT '0.00',
	"cash_payouts" numeric(10, 2) DEFAULT '0.00',
	"status" text DEFAULT 'open' NOT NULL,
	"notes" text,
	"reconciled_by" integer
);
--> statement-breakpoint
CREATE TABLE "stock_counts" (
	"id" serial PRIMARY KEY NOT NULL,
	"branch_id" integer DEFAULT nullif(current_setting('app.branch_id', true), '')::integer NOT NULL,
	"count_date" timestamp DEFAULT now() NOT NULL,
	"conducted_by" integer NOT NULL,
	"notes" text,
	"status" text DEFAULT 'completed' NOT NULL,
	"items" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" serial PRIMARY KEY NOT NULL,
	"branch_id" integer DEFAULT nullif(current_setting('app.branch_id', true), '')::integer NOT NULL,
	"ingredient_id" integer NOT NULL,
	"movement_type" text NOT NULL,
	"quantity_delta" numeric(12, 3) NOT NULL,
	"previous_stock" numeric(12, 3) NOT NULL,
	"new_stock" numeric(12, 3) NOT NULL,
	"reference_id" text,
	"unit_cost" numeric(10, 2),
	"reason" text,
	"created_by_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" serial PRIMARY KEY NOT NULL,
	"branch_id" integer DEFAULT nullif(current_setting('app.branch_id', true), '')::integer NOT NULL,
	"name" text NOT NULL,
	"contact_person" text,
	"email" text,
	"phone" text,
	"address" text,
	"payment_terms" text DEFAULT 'Net 30',
	"lead_time_days" integer DEFAULT 3,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"restaurant_id" integer NOT NULL,
	"branch_id" integer DEFAULT nullif(current_setting('app.branch_id', true), '')::integer NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"session_version" integer DEFAULT 0 NOT NULL,
	"pin_lookup" text,
	"pin" text,
	"role" text NOT NULL,
	"avatar_url" text,
	"phone" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
