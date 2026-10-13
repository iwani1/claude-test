-- A retried tender must replay the original payment, not take the money twice.
--
-- Cash and MoMo are recorded by hand, so the dangerous case is not a gateway
-- timeout: it is a cashier tapping Pay, the answer being lost on a flaky
-- connection, and the tender being entered again. Refunds already carry a
-- stable retry key; payments get the same guard here.
--
-- idempotency_key is stored on the first ledger line of a batch (a split writes
-- two), and the partial unique index keeps the retry from inserting a second
-- batch. request_fingerprint makes a key reused for a different amount fail
-- loudly instead of silently replaying the wrong tender.
ALTER TABLE payments ADD COLUMN IF NOT EXISTS idempotency_key text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS request_fingerprint text;
CREATE UNIQUE INDEX IF NOT EXISTS payments_branch_idempotency_key_idx
  ON payments (branch_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
