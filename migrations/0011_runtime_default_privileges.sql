-- Runtime access to future tables (Nov 2026, P11 in docs/FINDINGS.md).
--
-- The web app connects as pos_runtime, which is granted access to each table
-- by hand after migrations (docs/VPS_DEPLOYMENT.md, Phase 6). A migration that
-- created a table therefore needed that step repeated, and forgetting it gave
-- "permission denied" in production on the new feature.
--
-- Default privileges make every table and sequence that later migrations create
-- (as the migration owner running this) usable by pos_runtime straight away.
-- Row security still applies to every row: FORCE RLS policies are what limit
-- pos_runtime, not these grants. A future table the app must not write, as
-- with security_meta and schema_migrations, has to REVOKE explicitly in its
-- own migration.
--
-- Installations that create pos_runtime after migrating (the automated test
-- environment does) skip this; Phase 6 of the deployment guide covers them.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pos_runtime') THEN
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO pos_runtime';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO pos_runtime';
  END IF;
END
$$;
