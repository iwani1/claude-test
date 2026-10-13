-- The business trades in Ghana cedis. New restaurant rows default to GHS / GH₵
-- instead of USD / $. Only the defaults change: the seed already writes GHS / GH₵,
-- and existing rows keep whatever the owner set (Settings → currency).
--
-- restaurants is under forced row-level security, so a data update here would
-- silently match no rows. A column default is DDL and is not affected by RLS.
ALTER TABLE restaurants ALTER COLUMN currency SET DEFAULT 'GHS';
ALTER TABLE restaurants ALTER COLUMN currency_symbol SET DEFAULT 'GH₵';
