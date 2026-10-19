-- Per-user permissions (Oct 2026).
--
-- Until now a person's access was exactly their role's row in the permission
-- matrix, so the only way to give one trusted cashier a single extra ability
-- (or take one away) was to change their whole role. The owner can now select
-- permissions per user in Staff & Permissions: the selection is stored here
-- as only the keys that differ from the role's defaults, e.g.
-- {"canViewReports": true}. An empty object means "pure role defaults", so
-- every existing account behaves exactly as before this migration.
ALTER TABLE users ADD COLUMN IF NOT EXISTS permission_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;
