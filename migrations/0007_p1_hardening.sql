-- P1 hardening (docs/AUDIT_2026-10-13.md, F3 + F4).
--
-- F3: order deletion still erases the operational order, but first writes a
-- minimal tombstone in this table. It intentionally has NO foreign key to
-- orders (that would either block the deletion or cascade the evidence away)
-- and is never written to audit_logs, never exposed by any API, and has no
-- delete path in the application: it exists so an operator/accountant with
-- database access can prove a deleted order existed, what it totalled, and
-- who erased it. Branch RLS applies exactly like every other tenant table.
CREATE TABLE order_deletion_tombstones (
  id serial PRIMARY KEY,
  branch_id integer NOT NULL DEFAULT nullif(current_setting('app.branch_id', true), '')::integer,
  order_id integer NOT NULL,
  order_number text NOT NULL,
  order_type text,
  status text,
  payment_status text,
  total_amount numeric(10, 2) NOT NULL,
  paid_amount numeric(10, 2) NOT NULL,
  refunded_amount numeric(10, 2) NOT NULL DEFAULT '0.00',
  created_by_user_id integer,
  deleted_by integer NOT NULL,
  deleted_by_name text,
  order_created_at timestamp NOT NULL,
  deleted_at timestamp NOT NULL DEFAULT now(),
  reason text,
  CONSTRAINT order_deletion_tombstones_amounts_check CHECK (total_amount >= 0 AND paid_amount >= 0 AND refunded_amount >= 0),
  CONSTRAINT order_deletion_tombstones_once_per_order UNIQUE (branch_id, order_id)
);
ALTER TABLE order_deletion_tombstones ADD CONSTRAINT order_deletion_tombstones_identity UNIQUE (id, branch_id);
ALTER TABLE order_deletion_tombstones ADD CONSTRAINT order_deletion_tombstones_branch_fk FOREIGN KEY (branch_id) REFERENCES branches(id);
ALTER TABLE order_deletion_tombstones ADD CONSTRAINT order_deletion_tombstones_deleted_by_scope FOREIGN KEY (deleted_by, branch_id) REFERENCES users(id, branch_id);
ALTER TABLE order_deletion_tombstones ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_deletion_tombstones FORCE ROW LEVEL SECURITY;
CREATE POLICY branch_isolation ON order_deletion_tombstones USING (branch_id = current_branch()) WITH CHECK (branch_id = current_branch());

-- F4: hot-path indexes. Every list/report query is branch-scoped by RLS and
-- then filters/sorts by created_at; child ledgers are fetched by order/shift.
-- Names match the index() definitions in src/db/schema.ts.
CREATE INDEX order_deletion_tombstones_branch_deleted_idx ON order_deletion_tombstones (branch_id, deleted_at DESC);
CREATE INDEX orders_branch_created_idx ON orders (branch_id, created_at DESC, id DESC);
CREATE INDEX order_items_branch_order_idx ON order_items (branch_id, order_id);
CREATE INDEX kitchen_tickets_branch_order_idx ON kitchen_tickets (branch_id, order_id);
CREATE INDEX payments_branch_created_idx ON payments (branch_id, created_at DESC, id DESC);
CREATE INDEX payments_branch_order_idx ON payments (branch_id, order_id);
CREATE INDEX payments_branch_shift_idx ON payments (branch_id, shift_id);
CREATE INDEX refunds_branch_created_idx ON refunds (branch_id, created_at DESC, id DESC);
CREATE INDEX refunds_branch_order_idx ON refunds (branch_id, order_id);
CREATE INDEX audit_logs_branch_created_idx ON audit_logs (branch_id, created_at DESC, id DESC);
CREATE INDEX stock_movements_branch_created_idx ON stock_movements (branch_id, created_at DESC, id DESC);
CREATE INDEX stock_movements_branch_reference_idx ON stock_movements (branch_id, reference_id);
CREATE INDEX drawer_movements_branch_shift_idx ON drawer_movements (branch_id, shift_id);
