-- Per-staff shifts (Oct 2026).
--
-- Until now the database itself enforced one open shift per branch
-- (shifts_one_open_per_branch), so every cashier on duty sold into whoever
-- opened the register first, and cash accountability was pooled. Shifts are
-- now one per staff member: several can be open at once, each cashier
-- accountable for their own float, cash sales, payouts and refunds. The API
-- attaches every payment/payout/refund to the operator's own open shift,
-- and this index keeps the one-open-shift-per-person rule honest.
DROP INDEX IF EXISTS shifts_one_open_per_branch;
CREATE UNIQUE INDEX shifts_one_open_per_staff
  ON shifts (branch_id, user_id)
  WHERE status = 'open';
