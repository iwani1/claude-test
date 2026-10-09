-- Security constraints and FORCE RLS are mandatory, not optional optimizations.
CREATE TABLE security_meta (version integer PRIMARY KEY);
INSERT INTO security_meta VALUES (1);
CREATE TABLE auth_attempts (key text PRIMARY KEY, count integer NOT NULL, reset_at timestamptz NOT NULL);
CREATE FUNCTION current_branch() RETURNS integer LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.branch_id', true), '')::integer $$;
CREATE FUNCTION current_restaurant() RETURNS integer LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.restaurant_id', true), '')::integer $$;
ALTER TABLE branches ADD CONSTRAINT branches_restaurant_fk FOREIGN KEY (restaurant_id) REFERENCES restaurants(id);
ALTER TABLE branches ADD CONSTRAINT branches_identity UNIQUE (id, restaurant_id);
ALTER TABLE users ADD CONSTRAINT users_branch_restaurant_fk FOREIGN KEY (branch_id, restaurant_id) REFERENCES branches(id, restaurant_id);
CREATE UNIQUE INDEX users_branch_pin ON users(branch_id, pin_lookup) WHERE pin_lookup IS NOT NULL;
CREATE UNIQUE INDEX orders_branch_idempotency ON orders(branch_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX settings_branch_key ON application_settings(branch_id, key);
CREATE UNIQUE INDEX shifts_one_open_per_branch ON shifts(branch_id) WHERE status = 'open';
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('super_admin','manager','cashier','cook','inventory_officer','accountant'));
ALTER TABLE users ADD CONSTRAINT users_pin_hashed CHECK (pin IS NULL OR pin LIKE 'scrypt:%');
ALTER TABLE refunds ADD CONSTRAINT refunds_amount_positive CHECK (amount > 0);
ALTER TABLE payments ADD CONSTRAINT payments_amount_positive CHECK (amount > 0);
ALTER TABLE order_items ADD CONSTRAINT order_quantity_positive CHECK (quantity > 0);
ALTER TABLE ingredients ADD CONSTRAINT stock_nonnegative CHECK (current_stock >= 0);
ALTER TABLE orders ADD CONSTRAINT order_money_check CHECK (total_amount >= 0 AND paid_amount >= 0 AND paid_amount <= total_amount);


ALTER TABLE users ADD CONSTRAINT users_identity UNIQUE (id, branch_id);
ALTER TABLE users ADD CONSTRAINT users_branch_fk FOREIGN KEY (branch_id) REFERENCES branches(id);
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
CREATE POLICY branch_isolation ON users USING (branch_id = current_branch()) WITH CHECK (branch_id = current_branch());

ALTER TABLE shifts ADD CONSTRAINT shifts_identity UNIQUE (id, branch_id);
ALTER TABLE shifts ADD CONSTRAINT shifts_branch_fk FOREIGN KEY (branch_id) REFERENCES branches(id);
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts FORCE ROW LEVEL SECURITY;
CREATE POLICY branch_isolation ON shifts USING (branch_id = current_branch()) WITH CHECK (branch_id = current_branch());

ALTER TABLE dining_areas ADD CONSTRAINT dining_areas_identity UNIQUE (id, branch_id);
ALTER TABLE dining_areas ADD CONSTRAINT dining_areas_branch_fk FOREIGN KEY (branch_id) REFERENCES branches(id);
ALTER TABLE dining_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE dining_areas FORCE ROW LEVEL SECURITY;
CREATE POLICY branch_isolation ON dining_areas USING (branch_id = current_branch()) WITH CHECK (branch_id = current_branch());

ALTER TABLE dining_tables ADD CONSTRAINT dining_tables_identity UNIQUE (id, branch_id);
ALTER TABLE dining_tables ADD CONSTRAINT dining_tables_branch_fk FOREIGN KEY (branch_id) REFERENCES branches(id);
ALTER TABLE dining_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE dining_tables FORCE ROW LEVEL SECURITY;
CREATE POLICY branch_isolation ON dining_tables USING (branch_id = current_branch()) WITH CHECK (branch_id = current_branch());

ALTER TABLE menu_categories ADD CONSTRAINT menu_categories_identity UNIQUE (id, branch_id);
ALTER TABLE menu_categories ADD CONSTRAINT menu_categories_branch_fk FOREIGN KEY (branch_id) REFERENCES branches(id);
ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_categories FORCE ROW LEVEL SECURITY;
CREATE POLICY branch_isolation ON menu_categories USING (branch_id = current_branch()) WITH CHECK (branch_id = current_branch());

ALTER TABLE menu_items ADD CONSTRAINT menu_items_identity UNIQUE (id, branch_id);
ALTER TABLE menu_items ADD CONSTRAINT menu_items_branch_fk FOREIGN KEY (branch_id) REFERENCES branches(id);
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items FORCE ROW LEVEL SECURITY;
CREATE POLICY branch_isolation ON menu_items USING (branch_id = current_branch()) WITH CHECK (branch_id = current_branch());

ALTER TABLE modifiers ADD CONSTRAINT modifiers_identity UNIQUE (id, branch_id);
ALTER TABLE modifiers ADD CONSTRAINT modifiers_branch_fk FOREIGN KEY (branch_id) REFERENCES branches(id);
ALTER TABLE modifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE modifiers FORCE ROW LEVEL SECURITY;
CREATE POLICY branch_isolation ON modifiers USING (branch_id = current_branch()) WITH CHECK (branch_id = current_branch());

ALTER TABLE modifier_options ADD CONSTRAINT modifier_options_identity UNIQUE (id, branch_id);
ALTER TABLE modifier_options ADD CONSTRAINT modifier_options_branch_fk FOREIGN KEY (branch_id) REFERENCES branches(id);
ALTER TABLE modifier_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE modifier_options FORCE ROW LEVEL SECURITY;
CREATE POLICY branch_isolation ON modifier_options USING (branch_id = current_branch()) WITH CHECK (branch_id = current_branch());

ALTER TABLE menu_item_modifiers ADD CONSTRAINT menu_item_modifiers_identity UNIQUE (id, branch_id);
ALTER TABLE menu_item_modifiers ADD CONSTRAINT menu_item_modifiers_branch_fk FOREIGN KEY (branch_id) REFERENCES branches(id);
ALTER TABLE menu_item_modifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_item_modifiers FORCE ROW LEVEL SECURITY;
CREATE POLICY branch_isolation ON menu_item_modifiers USING (branch_id = current_branch()) WITH CHECK (branch_id = current_branch());

ALTER TABLE ingredients ADD CONSTRAINT ingredients_identity UNIQUE (id, branch_id);
ALTER TABLE ingredients ADD CONSTRAINT ingredients_branch_fk FOREIGN KEY (branch_id) REFERENCES branches(id);
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients FORCE ROW LEVEL SECURITY;
CREATE POLICY branch_isolation ON ingredients USING (branch_id = current_branch()) WITH CHECK (branch_id = current_branch());

ALTER TABLE recipes ADD CONSTRAINT recipes_identity UNIQUE (id, branch_id);
ALTER TABLE recipes ADD CONSTRAINT recipes_branch_fk FOREIGN KEY (branch_id) REFERENCES branches(id);
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes FORCE ROW LEVEL SECURITY;
CREATE POLICY branch_isolation ON recipes USING (branch_id = current_branch()) WITH CHECK (branch_id = current_branch());

ALTER TABLE recipe_ingredients ADD CONSTRAINT recipe_ingredients_identity UNIQUE (id, branch_id);
ALTER TABLE recipe_ingredients ADD CONSTRAINT recipe_ingredients_branch_fk FOREIGN KEY (branch_id) REFERENCES branches(id);
ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ingredients FORCE ROW LEVEL SECURITY;
CREATE POLICY branch_isolation ON recipe_ingredients USING (branch_id = current_branch()) WITH CHECK (branch_id = current_branch());

ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_identity UNIQUE (id, branch_id);
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_branch_fk FOREIGN KEY (branch_id) REFERENCES branches(id);
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements FORCE ROW LEVEL SECURITY;
CREATE POLICY branch_isolation ON stock_movements USING (branch_id = current_branch()) WITH CHECK (branch_id = current_branch());

ALTER TABLE stock_counts ADD CONSTRAINT stock_counts_identity UNIQUE (id, branch_id);
ALTER TABLE stock_counts ADD CONSTRAINT stock_counts_branch_fk FOREIGN KEY (branch_id) REFERENCES branches(id);
ALTER TABLE stock_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_counts FORCE ROW LEVEL SECURITY;
CREATE POLICY branch_isolation ON stock_counts USING (branch_id = current_branch()) WITH CHECK (branch_id = current_branch());

ALTER TABLE suppliers ADD CONSTRAINT suppliers_identity UNIQUE (id, branch_id);
ALTER TABLE suppliers ADD CONSTRAINT suppliers_branch_fk FOREIGN KEY (branch_id) REFERENCES branches(id);
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers FORCE ROW LEVEL SECURITY;
CREATE POLICY branch_isolation ON suppliers USING (branch_id = current_branch()) WITH CHECK (branch_id = current_branch());

ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_identity UNIQUE (id, branch_id);
ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_branch_fk FOREIGN KEY (branch_id) REFERENCES branches(id);
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders FORCE ROW LEVEL SECURITY;
CREATE POLICY branch_isolation ON purchase_orders USING (branch_id = current_branch()) WITH CHECK (branch_id = current_branch());

ALTER TABLE purchase_order_items ADD CONSTRAINT purchase_order_items_identity UNIQUE (id, branch_id);
ALTER TABLE purchase_order_items ADD CONSTRAINT purchase_order_items_branch_fk FOREIGN KEY (branch_id) REFERENCES branches(id);
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items FORCE ROW LEVEL SECURITY;
CREATE POLICY branch_isolation ON purchase_order_items USING (branch_id = current_branch()) WITH CHECK (branch_id = current_branch());

ALTER TABLE goods_receipts ADD CONSTRAINT goods_receipts_identity UNIQUE (id, branch_id);
ALTER TABLE goods_receipts ADD CONSTRAINT goods_receipts_branch_fk FOREIGN KEY (branch_id) REFERENCES branches(id);
ALTER TABLE goods_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE goods_receipts FORCE ROW LEVEL SECURITY;
CREATE POLICY branch_isolation ON goods_receipts USING (branch_id = current_branch()) WITH CHECK (branch_id = current_branch());

ALTER TABLE orders ADD CONSTRAINT orders_identity UNIQUE (id, branch_id);
ALTER TABLE orders ADD CONSTRAINT orders_branch_fk FOREIGN KEY (branch_id) REFERENCES branches(id);
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders FORCE ROW LEVEL SECURITY;
CREATE POLICY branch_isolation ON orders USING (branch_id = current_branch()) WITH CHECK (branch_id = current_branch());

ALTER TABLE order_items ADD CONSTRAINT order_items_identity UNIQUE (id, branch_id);
ALTER TABLE order_items ADD CONSTRAINT order_items_branch_fk FOREIGN KEY (branch_id) REFERENCES branches(id);
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items FORCE ROW LEVEL SECURITY;
CREATE POLICY branch_isolation ON order_items USING (branch_id = current_branch()) WITH CHECK (branch_id = current_branch());

ALTER TABLE kitchen_tickets ADD CONSTRAINT kitchen_tickets_identity UNIQUE (id, branch_id);
ALTER TABLE kitchen_tickets ADD CONSTRAINT kitchen_tickets_branch_fk FOREIGN KEY (branch_id) REFERENCES branches(id);
ALTER TABLE kitchen_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE kitchen_tickets FORCE ROW LEVEL SECURITY;
CREATE POLICY branch_isolation ON kitchen_tickets USING (branch_id = current_branch()) WITH CHECK (branch_id = current_branch());

ALTER TABLE payments ADD CONSTRAINT payments_identity UNIQUE (id, branch_id);
ALTER TABLE payments ADD CONSTRAINT payments_branch_fk FOREIGN KEY (branch_id) REFERENCES branches(id);
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments FORCE ROW LEVEL SECURITY;
CREATE POLICY branch_isolation ON payments USING (branch_id = current_branch()) WITH CHECK (branch_id = current_branch());

ALTER TABLE refunds ADD CONSTRAINT refunds_identity UNIQUE (id, branch_id);
ALTER TABLE refunds ADD CONSTRAINT refunds_branch_fk FOREIGN KEY (branch_id) REFERENCES branches(id);
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds FORCE ROW LEVEL SECURITY;
CREATE POLICY branch_isolation ON refunds USING (branch_id = current_branch()) WITH CHECK (branch_id = current_branch());

ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_identity UNIQUE (id, branch_id);
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_branch_fk FOREIGN KEY (branch_id) REFERENCES branches(id);
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;
CREATE POLICY branch_isolation ON audit_logs USING (branch_id = current_branch()) WITH CHECK (branch_id = current_branch());

ALTER TABLE application_settings ADD CONSTRAINT application_settings_identity UNIQUE (id, branch_id);
ALTER TABLE application_settings ADD CONSTRAINT application_settings_branch_fk FOREIGN KEY (branch_id) REFERENCES branches(id);
ALTER TABLE application_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_settings FORCE ROW LEVEL SECURITY;
CREATE POLICY branch_isolation ON application_settings USING (branch_id = current_branch()) WITH CHECK (branch_id = current_branch());

ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurants FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON restaurants USING (id = current_restaurant()) WITH CHECK (id = current_restaurant());

ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON branches USING (id = current_branch() AND restaurant_id = current_restaurant()) WITH CHECK (id = current_branch() AND restaurant_id = current_restaurant());

CREATE POLICY authentication_lookup ON users FOR SELECT USING (current_setting('app.auth', true) = '1');

CREATE POLICY authentication_lookup ON branches FOR SELECT USING (current_setting('app.auth', true) = '1');

ALTER TABLE dining_tables ADD CONSTRAINT dining_tables_area_id_scope FOREIGN KEY (area_id, branch_id) REFERENCES dining_areas(id, branch_id);

ALTER TABLE dining_tables ADD CONSTRAINT dining_tables_current_order_id_scope FOREIGN KEY (current_order_id, branch_id) REFERENCES orders(id, branch_id);

ALTER TABLE menu_items ADD CONSTRAINT menu_items_category_id_scope FOREIGN KEY (category_id, branch_id) REFERENCES menu_categories(id, branch_id);

ALTER TABLE modifier_options ADD CONSTRAINT modifier_options_modifier_id_scope FOREIGN KEY (modifier_id, branch_id) REFERENCES modifiers(id, branch_id);

ALTER TABLE menu_item_modifiers ADD CONSTRAINT menu_item_modifiers_menu_item_id_scope FOREIGN KEY (menu_item_id, branch_id) REFERENCES menu_items(id, branch_id);

ALTER TABLE menu_item_modifiers ADD CONSTRAINT menu_item_modifiers_modifier_id_scope FOREIGN KEY (modifier_id, branch_id) REFERENCES modifiers(id, branch_id);

ALTER TABLE ingredients ADD CONSTRAINT ingredients_supplier_id_scope FOREIGN KEY (supplier_id, branch_id) REFERENCES suppliers(id, branch_id);

ALTER TABLE recipes ADD CONSTRAINT recipes_menu_item_id_scope FOREIGN KEY (menu_item_id, branch_id) REFERENCES menu_items(id, branch_id);

ALTER TABLE recipe_ingredients ADD CONSTRAINT recipe_ingredients_recipe_id_scope FOREIGN KEY (recipe_id, branch_id) REFERENCES recipes(id, branch_id);

ALTER TABLE recipe_ingredients ADD CONSTRAINT recipe_ingredients_ingredient_id_scope FOREIGN KEY (ingredient_id, branch_id) REFERENCES ingredients(id, branch_id);

ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_ingredient_id_scope FOREIGN KEY (ingredient_id, branch_id) REFERENCES ingredients(id, branch_id);

ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_created_by_id_scope FOREIGN KEY (created_by_id, branch_id) REFERENCES users(id, branch_id);

ALTER TABLE stock_counts ADD CONSTRAINT stock_counts_conducted_by_scope FOREIGN KEY (conducted_by, branch_id) REFERENCES users(id, branch_id);

ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_supplier_id_scope FOREIGN KEY (supplier_id, branch_id) REFERENCES suppliers(id, branch_id);

ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_created_by_id_scope FOREIGN KEY (created_by_id, branch_id) REFERENCES users(id, branch_id);

ALTER TABLE purchase_order_items ADD CONSTRAINT purchase_order_items_purchase_order_id_scope FOREIGN KEY (purchase_order_id, branch_id) REFERENCES purchase_orders(id, branch_id);

ALTER TABLE purchase_order_items ADD CONSTRAINT purchase_order_items_ingredient_id_scope FOREIGN KEY (ingredient_id, branch_id) REFERENCES ingredients(id, branch_id);

ALTER TABLE goods_receipts ADD CONSTRAINT goods_receipts_purchase_order_id_scope FOREIGN KEY (purchase_order_id, branch_id) REFERENCES purchase_orders(id, branch_id);

ALTER TABLE goods_receipts ADD CONSTRAINT goods_receipts_received_by_scope FOREIGN KEY (received_by, branch_id) REFERENCES users(id, branch_id);

ALTER TABLE orders ADD CONSTRAINT orders_table_id_scope FOREIGN KEY (table_id, branch_id) REFERENCES dining_tables(id, branch_id);

ALTER TABLE orders ADD CONSTRAINT orders_user_id_scope FOREIGN KEY (user_id, branch_id) REFERENCES users(id, branch_id);

ALTER TABLE orders ADD CONSTRAINT orders_complimentary_approved_by_scope FOREIGN KEY (complimentary_approved_by, branch_id) REFERENCES users(id, branch_id);

ALTER TABLE order_items ADD CONSTRAINT order_items_order_id_scope FOREIGN KEY (order_id, branch_id) REFERENCES orders(id, branch_id);

ALTER TABLE order_items ADD CONSTRAINT order_items_menu_item_id_scope FOREIGN KEY (menu_item_id, branch_id) REFERENCES menu_items(id, branch_id);

ALTER TABLE kitchen_tickets ADD CONSTRAINT kitchen_tickets_order_id_scope FOREIGN KEY (order_id, branch_id) REFERENCES orders(id, branch_id);

ALTER TABLE payments ADD CONSTRAINT payments_order_id_scope FOREIGN KEY (order_id, branch_id) REFERENCES orders(id, branch_id);

ALTER TABLE payments ADD CONSTRAINT payments_processed_by_scope FOREIGN KEY (processed_by, branch_id) REFERENCES users(id, branch_id);

ALTER TABLE refunds ADD CONSTRAINT refunds_order_id_scope FOREIGN KEY (order_id, branch_id) REFERENCES orders(id, branch_id);

ALTER TABLE refunds ADD CONSTRAINT refunds_payment_id_scope FOREIGN KEY (payment_id, branch_id) REFERENCES payments(id, branch_id);

ALTER TABLE refunds ADD CONSTRAINT refunds_authorized_by_scope FOREIGN KEY (authorized_by, branch_id) REFERENCES users(id, branch_id);

ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_user_id_scope FOREIGN KEY (user_id, branch_id) REFERENCES users(id, branch_id);

ALTER TABLE shifts ADD CONSTRAINT shifts_user_id_scope FOREIGN KEY (user_id, branch_id) REFERENCES users(id, branch_id);

ALTER TABLE shifts ADD CONSTRAINT shifts_reconciled_by_scope FOREIGN KEY (reconciled_by, branch_id) REFERENCES users(id, branch_id);
