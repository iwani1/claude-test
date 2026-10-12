# Legacy POS Data Import (restpos → current system)

This runbook migrates the data from the old Android POS (`restpos.db` SQLite
backups) into the running PostgreSQL system. The importer is idempotent: it can
be run today, then re-run on switch day to pick up the final days of trading.

## What is imported

| Legacy source | Target | Notes |
|---|---|---|
| `rest_category`, `rest_item` | `menu_categories`, `menu_items` | Prices, costs, enable flags. Duplicate name+category items collapse (first wins); sold-but-removed items become disabled stubs. |
| `rest_user` | `users` | Staff accounts. **Legacy plaintext PINs/passwords are never copied** — each account gets a fresh random 4-digit PIN (written to a CSV) and an unusable password. |
| `rest_order`, `rest_order_item`, `rest_order_payment` | `orders`, `order_items`, `payments` | Full sales history with money split (cash/momo/card), service charges, discounts, tips. Order numbers are prefixed `OLD-`. |
| `rest_table`, `rest_table_group` | `dining_areas`, `dining_tables` | Includes the `Bar` and `Takeout` counters. |
| `inventory_item`, `inventory_vendor` | `ingredients`, `suppliers` | Opening stock starts at 0 — do a Stock Audit count on site. |
| `rest_customer`, `rest_member_type` | `application_settings.legacy_customers` | Preserved as JSON (the current system has no members module yet). |

Status mapping: legacy 1 → `completed`, 2 → `cancelled`, 0 (still open) →
`draft` with a warning — complete or cancel those after cutover. Tax is imported
as recorded (the legacy 4% + 4.875% config was **never charged**; every legacy
order carries GH₵0.00 tax).

## Prerequisites

- The target database is migrated and bootstrapped (`npm run db:migrate`,
  `npm run db:bootstrap` — see `docs/VPS_DEPLOYMENT.md`).
- `AUTH_SECRET` from the production `.env` (needed for PIN lookup digests).
- A **maintenance** connection string (`pos_owner`) — the importer runs like
  `db:bootstrap`/`db:migrate` and is blocked for the runtime role.

## Steps (on the VPS)

```sh
cd /opt/pos
cp /wherever/2026-10-12_restpos.db /tmp/restpos.db   # keep the backup out of the repo

# 1. Dry run first — read every warning
sudo -u pos npx tsx scripts/import-restpos.ts --source /tmp/restpos.db --report

# 2. Apply (safe to re-run; nothing existing is overwritten)
export MIGRATION_DATABASE_URL='postgresql://pos_owner:OWNER_PASSWORD@127.0.0.1:5432/pos'
export AUTH_SECRET='…same value as .env…'
sudo -E -u pos npx tsx scripts/import-restpos.ts \
  --source /tmp/restpos.db --apply --credentials-out /root/imported-pins.csv

# 3. Sign in and spot-check: menu, an old receipt in history, staff list.
# 4. Distribute the fresh PINs from /root/imported-pins.csv, then delete the file.
# 5. Reset staff passwords (Staff Manager → Reset password) — imported accounts
#    cannot sign in with a password until you do.
```

On **switch day** (after the last sale on the old system), export a fresh
`restpos.db` and repeat steps 1–3 — everything new is added, everything already
imported is skipped.

## After the cutover checklist

- [ ] Review the 10 OPEN legacy orders (imported as drafts) — complete or cancel.
- [ ] Count opening stock (Inventory → Stock Audit) — ingredients import at 0.
- [ ] Decide VAT treatment with the accountant (legacy sales carry GH₵0.00 tax;
      the VAT rate in the current system is configurable in Settings).
- [ ] Delete `restpos.db` copies from GitHub and local machines — the file
      contains **plaintext staff PINs and customer phone numbers**.
- [ ] Change every staff PIN/password (the importer already discarded the old
      credentials; rotate again once staff are trained).
- [ ] Keep one archived copy of `restpos.db` for the accountant (encrypted
      USB/offline), then destroy the rest.

## Verification

`npm run test:legacy-import` runs the whole path against a disposable database
with a synthetic fixture (mappings, credential hygiene, idempotency). The
2026-10-12 real backup was additionally reconciled end-to-end: 2,030 orders /
GH₵211,560 sales / GH₵132,125 cash + GH₵77,655 MoMo + GH₵1,780 card — every
total matches the source exactly, and a second run inserts nothing.
