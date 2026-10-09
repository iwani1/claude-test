# One-branch pilot and release decision

Status: **candidate for supervised pilot, not approved for production rollout**.
Automated results are engineering evidence, not business/financial approval.

## Automated gate

Run `npm ci`, `npm run lint -- --max-warnings=0`, `npm run typecheck`,
`npm run test:security`, and `npm audit --omit=dev`.
The test command builds production Next, starts a disposable PostgreSQL database
with restricted runtime credentials, executes security and synthetic shift tests,
then stops the services. It never uses production data. Ports 15432/3100 must be free.

The synthetic pilot starts with a GH₵200 float, sells GH₵20 split tender (cash 8,
MoMo 12), sells GH₵10 cash, returns that GH₵10 through partial/final refunds,
records a GH₵3 petty-cash payout, and closes at GH₵205 with zero difference
(the GH₵10 cash refunds now debit the drawer automatically and are linked to
their refunds). It verifies kitchen-ticket creation, table release, change, stock
restoration, and offline replay deduplication. A separate accounting suite covers
refund tender allocation, retry idempotency, drawer-movement linkage, refund of
old sales against the current shift, closed-shift immutability, refund/close
races, legacy unallocated refunds, and event-date collection reporting.
These are manual-tender simulations; no money moves and no paper prints.

## Preflight — site manager + operator

- [ ] Record candidate commit, branch, deployment URL, date, operator, and approver.
- [ ] Use a staging database and non-production cash/MoMo records for rehearsal.
- [ ] Provision explicit accounts; do not deploy demo users/PINs from test fixtures.
- [ ] Check HTTPS, production Secure cookies, runtime DB privileges, secret storage,
      edge rate limits, network access, monitoring, and the health endpoint.
- [ ] Inventory every pending legacy offline queue. Export/reconcile before cutover;
      the new branch-keyed cache does not automatically import old global queues.
- [ ] Confirm branch mappings, opening stock, prices, opening balances and staff roles.

## On-site acceptance — record evidence, not just checkmarks

| Scenario | Expected evidence | Responsible party |
|---|---|---|
| Sign in / switch / logout | Correct branch and role; old copied session denied after logout | Site manager |
| Dine-in order | Correct table, quantities, modifiers and total; paper docket delivered | Cashier + kitchen |
| Thermal printing | Legible text, no clipped columns, correct paper width, one intended print | Operator |
| Cash payment | Tender/change correct; actual notes/coins agree with ledger | Cashier |
| MoMo payment | Provider reference and confirmed receipt agree with manual POS entry | Cashier + finance |
| Split tender | Cash and confirmed MoMo sum exactly to the bill | Cashier |
| Partial/final refund | Manager approval; tender split matches original cash/MoMo; refund recorded once; cash drawer debited automatically and linked | Manager + finance |
| Prepared-food refund | Stock return off unless goods genuinely returned/reusable | Kitchen + inventory |
| Offline order | Queue survives reload; reconnect/retry creates one order; prices revalidated | Operator |
| Offline failure | Invalid item/shortage leaves entire batch queued for correction | Operator |
| Branch switch | No other branch's cached menu or queued order exposed in normal UI | Site manager |
| Shift close | Physical cash, MoMo statement, refunds and payouts reconcile; closed shifts cannot be rewritten | Finance |
| Failure/recovery | Restart does not duplicate transactions; restore rehearsal passes | Administrator |

Capture receipt/docket photos, POS order IDs, MoMo references (redacted), refund
IDs, opening/closing counts, stock counts, and exception logs. Do not put real
customer data, credentials or payment identifiers in the repository.

## Accounting approval — required before trading

A Ghana-qualified accountant/business approver must sign off current tax rules,
receipt fields, discount authority, complimentary meals, refund/stock policy,
and reporting definitions. Do not assume the default tax configuration is correct.

Current limitations to explicitly accept or fix:
- MoMo and refunds are records, not verified gateway transactions; a completed
  MoMo reversal must be verified in the provider account by finance.
- Cash refunds now automatically create a uniquely linked drawer outflow on the
  shift that hands the cash back (which may be a later shift than the sale).
  Manual payouts are for non-refund cash only and cannot be re-pointed at refunds.
- The dashboard separates gross collections, refunds, and net collections by
  transaction date, and reports legacy refunds with unknown tender as such.
  Item/category charts remain gross bill analysis, and the CSV is a reconciliation
  ledger for review — neither is a certified tax return or accounting-software
  import. Finance still reconciles against the provider statement and cash count.
- No automatic cross-branch owner view or legacy ownership conversion is supplied.

If these manual controls are unacceptable, stop the pilot and implement the
required workflow/reporting changes before live use.

## Backup / restore rehearsal — administrator, isolated target only

1. Schedule a consistent PostgreSQL backup with matching-version `pg_dump -Fc`.
   Supply credentials via a secret manager or protected `.pgpass`, not command logs.
2. Store encrypted backups outside the application host with restricted access.
   Record retention, storage owner, recovery-point objective and recovery-time objective.
3. Restore using `pg_restore --exit-on-error --no-owner` into a **new isolated database**.
   Never rehearse a restore over the live database.
4. Provision runtime grants on the restore; verify FORCE RLS/policies, foreign keys,
   migration checksums, and all table/sequence counts. Reconcile payment/refund totals
   and ingredient stock balances against the captured backup baseline.
5. Run login, branch-isolation, order and ledger checks on the restored staging copy.
6. Record backup time, restore duration, checksum, row/balance comparisons and approver.

No live backup or physical restore has been performed by the coding agent.

## Rollout and stop conditions

Pilot one branch/terminal, train operators, and retain an independent daily
reconciliation record. Stop immediately for unexplained cash/stock differences,
duplicate payments/refunds, lost queues, authorization leaks, unreadable dockets,
or failed backups. Stop taking new writes before rollback; preserve the database
and logs. Never overwrite newer transactions with an old backup without finance
and administrator reconciliation.

Expand only after the business specifies its acceptance period and all sign-offs
are complete. A passing CI run is necessary, not sufficient.

### Sign-off record

- Candidate commit / PR:
- Site / terminal / device / printer:
- Test date / evidence location:
- Operator and site manager:
- Accountant approval:
- Administrator backup/restore approval:
- Known exceptions accepted (including tooling advisory review):
- Decision: HOLD / SUPERVISED PILOT / APPROVED ROLLOUT
