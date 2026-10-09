-- Historical rows are intentionally unallocated: never guess their tender/shift.
ALTER TABLE refunds ADD COLUMN cash_amount numeric(10,2);
ALTER TABLE refunds ADD COLUMN momo_amount numeric(10,2);
ALTER TABLE refunds ADD COLUMN shift_id integer;
ALTER TABLE refunds ADD COLUMN idempotency_key text;
ALTER TABLE refunds ADD COLUMN request_fingerprint text;
ALTER TABLE refunds ADD CONSTRAINT refund_tender_balance CHECK (
  (cash_amount IS NULL AND momo_amount IS NULL) OR
  (cash_amount IS NOT NULL AND momo_amount IS NOT NULL AND cash_amount >= 0 AND momo_amount >= 0 AND cash_amount + momo_amount = amount)
);
ALTER TABLE refunds ADD CONSTRAINT refund_shift_scope FOREIGN KEY (shift_id, branch_id) REFERENCES shifts(id, branch_id);
CREATE UNIQUE INDEX refund_request_key ON refunds(branch_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
ALTER TABLE payments ADD COLUMN shift_id integer;
ALTER TABLE payments ADD CONSTRAINT payment_shift_scope FOREIGN KEY (shift_id, branch_id) REFERENCES shifts(id, branch_id);
CREATE TABLE drawer_movements (
  id serial PRIMARY KEY,
  branch_id integer NOT NULL DEFAULT current_branch() REFERENCES branches(id),
  shift_id integer NOT NULL,
  refund_id integer UNIQUE,
  kind text NOT NULL CHECK (kind IN ('refund', 'payout')),
  amount numeric(10,2) NOT NULL CHECK (amount > 0),
  reason text NOT NULL,
  created_by integer NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT drawer_refund_kind CHECK ((kind = 'refund') = (refund_id IS NOT NULL)),
  FOREIGN KEY (shift_id, branch_id) REFERENCES shifts(id, branch_id),
  FOREIGN KEY (refund_id, branch_id) REFERENCES refunds(id, branch_id),
  FOREIGN KEY (created_by, branch_id) REFERENCES users(id, branch_id)
);
ALTER TABLE drawer_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE drawer_movements FORCE ROW LEVEL SECURITY;
CREATE POLICY branch_isolation ON drawer_movements USING (branch_id = current_branch()) WITH CHECK (branch_id = current_branch());
