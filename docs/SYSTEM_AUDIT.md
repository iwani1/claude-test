# System audit — 12 October 2026

A full pass over the running system: every API route, every screen, the money
paths, the stock paths, the offline layer and the deployment tooling. It is
written to be checkable rather than reassuring — each claim below names the
evidence, and everything still open is listed as open.

**Audited at:** `8e402e9` and updated on the commit that follows it on
branch `arena/181e4004-claude-test` (the deletion fix below)
**Performed by:** the agent, from the repository and a disposable PostgreSQL —
not from the production server, not with a browser, not with hardware.

## How it was done

| Method | What it covered |
|---|---|
| `npm run test:security` | 180 security (including a stale-database scenario and staff removal) + 78 pilot + 30 accounting checks against a disposable database and a production build |
| `npm run audit:responsive` | 28 components + 2 app files: tables scroll or become cards, dialogs scroll, no `h-screen`/`w-screen`, no unguarded fixed widths |
| `npm run audit:workflows` | **new** — swallowed failures in client code, fetches parsed without a status check, money routes without an idempotency guard, routes without a permission check, tables without a phone view |
| Route sweep | all 27 route handlers read for permission gates, error envelopes and money/stock writes |
| Ledger sweep | schema, constraints and migrations read for locks, idempotency, RLS and cascade behaviour |
| Evidence queries | `grep`/SQL checks for RLS coverage, error leakage, secrets in logs, tap-target sizes, session/cookie flags |

## Verified sound

**Access control**
- Every table holding tenant data (28) has `ENABLE` **and** `FORCE ROW LEVEL
  SECURITY` with a branch-isolation policy; `security_meta` and `auth_attempts`
  are global by design (`security_meta` is the tamper canary that every request
  checks, and the runtime role's write access to it is revoked).
- Every request runs in a branch-scoped transaction that refuses to serve if the
  database role can bypass RLS, and every business route passes a permission
  (the only unwrapped route is `/api/health`, which returns `{ok:true|false}`).
- Sessions: HMAC-signed cookie, `httpOnly`, `secure` in production,
  `sameSite=lax`, 8-hour expiry, re-validated against `sessionVersion` on every
  request (so a revoked user is out immediately). Passwords/PINs are scrypt
  (N=32768); legacy pbkdf2 hashes are upgraded on the next successful sign-in.
- Cross-origin writes are rejected, JSON content-type is required, oversized
  bodies are refused, and login/PIN/refund paths are rate limited.

**Money**
- All arithmetic is integer pesewas; `orders.paid_amount` is gross and refunds
  live in their own ledger, so "money still in hand" is always
  `paid_amount − Σrefunds` — the reports and receipts say so explicitly.
- `payments` locks the order row (`SELECT … FOR UPDATE`) and refuses
  overpayment; payments, bill, shift totals, table release and the audit line
  commit together.
- Order creation and refunds are idempotent (stable key + request fingerprint,
  advisory-locked, a reused key with different details is a 409 — never a silent
  replay of the wrong amount).
- `order_money_check` (paid ≤ total) makes "an order holding more money than its
  bill" structurally impossible.
- Deleting an order erases its children (`order_items`, `payments`, `refunds`,
  refund-linked `drawer_movements`, `kitchen_tickets`, audit rows) and rolls the
  shift totals back, so the drawer still reconciles afterwards — asserted in the
  pilot suite. Manual payouts are not tied to orders, so they cannot be orphaned.

**Stock**
- Order edits re-price on the server and re-sync stock by a **net** transactional
  diff (not gross restore), so editing up then cancelling returns exactly what
  the order held.
- Manual adjustments and goods receipts now take a row lock inside a transaction
  (see fixes below), and the ledger records the delta that was actually applied.

**Feedback — nothing fails silently**
- All 8 screens that load data now show a retryable failure strip instead of an
  empty screen (`LoadFailure`). The audit that enforces this reports **0
  unexplained swallowed failures**; the 20 intentional fallbacks are annotated
  in the source with `audit-ok: <reason>`.
- The till never claims a sale is safe unless it verified the queue write, never
  claims a payment landed unless the server said so, and clears an offline banner
  only after a real answer from the server.

**Devices**
- 0 failures / 0 warnings from the responsive audit; no button below the 44px
  touch floor was found by the sweep; phone drawer + bottom tab bar, card rows on
  phones, real tables at md+, safe areas and `dvh` throughout.

## Fixed during this audit

| Severity | Finding | Fix |
|---|---|---|
| **High** | A retried **partial** payment was recorded twice: if the answer to "Pay" was lost, entering the same tender again added it to the bill a second time (a full payment was caught by the balance check, a deposit was not). | `migrations/0004_payment_idempotency.sql` + pay route: stable key per attempt with a request fingerprint, advisory-locked, replay returns the original outcome, a reused key with a different amount is a 409. The till now pins one key per attempt, and after a lost answer it **asks the server what happened** before the cashier takes money again. Covered by 6 new pilot checks. |
| **High** | Receiving the same purchase order twice added the delivery to stock twice (no status guard, no transaction, no row lock), and a partial failure could leave stock updated with no GRN. | `receive_goods` now runs in one transaction against a locked PO, refuses an already-received PO, refuses lines that belong to another PO or appear twice, and locks each ingredient row. 4 new pilot checks. |
| **Medium** | Manual stock adjustments were read-modify-write with no lock: two concurrent adjustments lost one another, and the ledger could record a delta the shelf never took (an over-large write-off logged −1050 while stock only fell 100). | Adjustment is transactional with a locked ingredient row, records the **applied** delta, and refuses a zero adjustment. 4 new pilot checks. |
| **High** | Erasing an order that had been refunded left the shift's cash-outflow total behind, so the drawer reconciled short by the refunded amount and could never be closed flat again. | `DELETE /api/orders/[id]` reverses the erased refunds on the shift that paid them, in the same transaction as the sales rollback; 8 pilot checks cover the whole cycle. |
| **High** | Deploying code without applying its migration made ordinary work fail with a bare "Request failed" — order deletion was the visible casualty. | `schema-guard.ts` names what the code needs, `/api/health` reports `schema-behind`, every affected operation answers 503 with the exact missing column and the command that fixes it, and an audit rule keeps the list in step with `migrations/`. The rest of the till keeps trading. See the section below. |
| **Medium** | 8 screens swallowed load failures (`console.error` only), so a broken connection looked like "no stock", "no sales", "no staff". | `LoadFailure` strip with a 44px Retry on every one of them. |
| **Medium** | A failed sign-out was silent: the screen cleared while the session cookie could still be alive — dangerous on a shared terminal. | Sign-out now reports the failure and asks for a retry once connected. |
| **Low** | API **error** responses carried no `Cache-Control`, so a browser or proxy could keep serving a 503/401 after the cause was fixed — it made a repaired production system look broken while the owner and I chased a phantom. Success responses already said `no-store`; failures did not. | Every error answer sets `Cache-Control: no-store`, and `/api/health` too (asserted in the suite; re-check any cached URL with a `?probe=1` suffix). |
| **Low** | The stock-adjustment submit button was a 28px target (below the touch floor) and could be double-tapped. | 44px minimum, in-flight guard, "Committing…" state. |
| **Medium** *(13 Oct)* | **A staff account could not be removed at all.** The owner asked for it; the capability had never been built, and a raw row delete is refused by Postgres while orders point at the person. | Owner-only removal from the roster: `migrations/0005_staff_removal.sql`, `delete_user` action, Delete in Staff behind a confirm dialog. Credentials wiped, sessions revoked, sales and their names kept, activity-log entry written. 14 security checks + 25 live checks. See the section below. |
| **Low** | An offline payment notice promised "it will not be charged twice" before the server could guarantee it. | The promise is now backed by payment idempotency, and the notice points at the safe action (retry, or check Order History). |

## Missed on the first pass: order deletion on a stale database

**What the user saw:** *"i tried deleting an order and i had error"* — the delete
request answered `Request failed` (HTTP 500) and the order stayed where it was.

**What actually happened:** the repository was consistent — code and migration
both added `payments.idempotency_key`. The **database** was not: the running
environment had never had `migrations/0004_payment_idempotency.sql` applied.
Drizzle selects every column it knows about, so the payment step of the delete
asked for `payments.idempotency_key` and Postgres refused with `column
"idempotency_key" does not exist` (SQLSTATE 42703). The generic 500 handler then
reported "Request failed" and the real reason never reached anyone.

**Why the audit missed it:** every suite in this repository migrates a fresh
database before it runs, so the tests could only ever see code and schema in
step. The state that breaks is the one *between* a code deploy and the
migration — and no test created it. The lesson is not "look harder": that state
is now impossible to be silent about.

**What changed**

- The app checks the columns this version needs and *says so* instead of failing
  mysteriously. Two places: `/api/health` reports the gap, and any operation that
  actually needs a missing piece answers **503** naming it, for example: *"The
  database is missing an update this version needs (payments.idempotency_key).
  Run `npm run db:migrate` on the server with MIGRATION_DATABASE_URL set, then
  restart the app."* Everything that does not depend on the missing piece keeps
  working — a stale database degrades the till, it does not stop the venue.
- `/api/health` reports `{ok:false, reason:"schema-behind", missing:[…]}`, so
  the deploy script's health gate and the operator see it at once.
- Any other mismatch — missing table, missing grant — is translated the same
  way instead of becoming a bare 500.
- `scripts/audit-workflows.py` now fails when a migration adds a column that is
  not listed in `src/lib/schema-guard.ts`. Writing that rule immediately caught
  that the list itself was incomplete: columns added by migrations 0002 and
  0003 were missing from it.
- `tests/security.ts` reproduces the incident against its disposable database:
  it drops the column, asserts the 503 message and the health report, re-applies
  the migration, and asserts the delete that was refused now succeeds.
- The running environment was repaired with
  `MIGRATION_DATABASE_URL=… npm run db:migrate`, and the delete then returned
  200 for the same order.

**Operator note:** a release that adds a migration must run
`npm run db:migrate` before the app restarts. `scripts/deploy-vps.sh` does that
automatically — it stops before touching the working tree when a migration is
present but `MIGRATION_DATABASE_URL` is missing — and the by-hand steps in
`docs/VPS_DEPLOYMENT.md` include it too. If the app ever answers 503 with
`schema-behind`, that is this check, not a crash.

## Found by driving the live environment: erasing a refunded order broke the drawer

The suites all passed, so the next step was to walk the running system: every
screen, then a real sale on the live preview — ring it up, take cash, refund
part of it, erase the order, close the register.

**What broke:** the drawer could no longer be closed flat. `shifts.cash_payouts`
carries cash refunds out of the drawer, and the close formula is
`expected = opening + cash sales − payouts`. Erasing an order rolled back its
sales and deleted its refund movements, but left the refund in `cash_payouts`,
so the shift expected a drawer short by exactly the refunded amount — a phantom
loss the cashier could not explain or correct. In the wild it reads as "the till
says I'm 20 short and I've taken nothing".

**Fix:** `DELETE /api/orders/[id]` now reverses the erased order's cash refunds
on the shift that paid them, in the same transaction as the sales rollback, and
the pilot suite asserts the whole cycle — refund shows as outflow, erase clears
it, drawer closes with a 0.00 difference. Verified on the live preview:
`2.00` outflow while the refund existed → `0.00` after the erase → register
closed with `difference: 0.00`.

**Why the suites missed it:** every drawer test refunded and then *kept* the
order. Erasing a refunded order was the one combination nobody had walked.

### The first version of that guard was too blunt — corrected the same night

The first cut refused **every** request while the schema was behind, on the
theory that a money system should not run against an unknown schema. That theory
met a real hotel: deploying the new code before the migration left production
answering `schema-behind` to *every* call, including sign-in, so the till was
completely stopped until someone ran one command. A venue in service needs to
keep selling.

It now degrades instead of stopping: reads, sales and the kitchen keep working,
the operations that genuinely need the missing column answer 503 with the fix,
and `/api/health` still reports `schema-behind` — which is where the hard stop
belongs, because `scripts/deploy-vps.sh` gates on it *before* anyone is serving
from it. `tests/security.ts` asserts both halves: the venue keeps trading, the
payment-dependent operation refuses loudly.

## Found by the owner, 13 October: a staff account could not be deleted

**Reported:** "im not able to delete staff account".

**What was actually there:** nothing to fail. `DELETE /api/staff` answered `405`,
`{"action":"delete_user"}` answered `400 Invalid action`, and the Staff screen
offered only Add / Change PIN / Reset Password / Deactivate. Removal had never
been built — the report was a missing capability, not a regression.

**Why it cannot simply be a `DELETE`:** ten of the fifteen imported accounts have
sold things, and eleven foreign keys point at `users` (`orders.user_id`,
`payments.processed_by`, `refunds.authorized_by`, `shifts.user_id`,
`audit_logs.user_id`, the stock and purchasing authors,
`drawer_movements.created_by`). Postgres refuses the row while any of them exist
— reproduced as `23503` on `orders_user_id_scope` for a cashier with 17 sales —
and deleting those sales instead would shrink the books and lose who took the
money.

**What was built** (owner's choices: off the roster / keep their sales / log it /
owner only): `migrations/0005_staff_removal.sql` adds `users.deleted_at`. The
`delete_user` action marks the row, wipes the password hash, PIN, PIN lookup,
phone and avatar, moves the login address to `removed-<id>@deleted.invalid`
(freeing the real address and the PIN for a rehire), bumps `session_version` so
a live session dies at once, and returns a note when the person still has a till
open. Managers get `403`; nobody can remove themselves; a second attempt gets
`409`. The roster stops listing the account; every past sale keeps the name of
whoever took the money; the activity log records who removed whom.

**Verified live** — 25 checks on the running preview, after a 14-check security
block: an employee with a sale and an open till is removed by the owner, the
roster drops them, sign-in and the live session both fail, the sale still reads
under their name in the books, the activity log names the owner who did it, the
open-till warning appears and that till is still closable, and the freed email
and PIN work for a new account.

**The fallback that failed first, and why it matters.** The staff list had to
keep working on a database that had not run 0005 yet — production serves the old
build until the migration lands. The first version caught the missing-column
error and retried without the filter, and still answered `500`: in Postgres a
failed statement **aborts the whole transaction**, so the retry ran inside a
poisoned transaction and died for a different reason. The screen now asks the
catalogue (`columnExists`) *before* choosing which query to run, because asking
never fails. On the un-migrated preview the list then answered `200` with all
fifteen accounts while the removal itself answered `503` naming
`users.deleted_at` and the `npm run db:migrate` command.

## Final pass before cutover, 13 October

Re-run end to end on the release the venue is getting:

| Check | Result |
|---|---|
| `npm run test:security` | **180 security / 78 pilot / 30 accounting**, exit 0 (fresh database, production build, RLS enforced) |
| `npm run audit:workflows` | 0 failures, 27 warnings, 56 advisories — unchanged baseline |
| `npm run audit:responsive` | 0 failures, 0 warnings |
| `tsc --noEmit`, `eslint` | clean |
| Live walkthrough (preview, real imported data) | 23/23 — every screen, then the money cycle: sale → partial cash payment → refund → erase → stock restored → drawer closed flat |
| Staff removal, live | 25/25 — employee with a sale and an open till removed by the owner; sign-in and the live session die; the sale keeps the name; activity log written; rehire works on the freed email and PIN |
| Concurrent removal of the same account | one `200`, one `409` — the row lock and the tombstone check hold under a double tap |
| Cross-branch removal attempt | `404` (RLS hides the row) |

**Found and fixed in this pass:** a database the app cannot reach was answered
with `{"error":"Request failed"}` — indistinguishable from a wrong password, and
on 12 October that sent the owner hunting for a password reset while the till was
down for a different reason (a `.env`/role password mismatch made by the
deployment steps themselves). The app now names it: `503` with *"The server
cannot reach its database: the database rejected the app's login (not your
password — this is the app's own connection)…"*, or *"the database service is not
answering"* when PostgreSQL is stopped; `/api/health` answers
`{"ok":false,"reason":"database-unreachable"}` and the server log line carries the
driver code. Proven against real broken configurations (a wrong password and a
closed port), not by inspection. 5 new checks.

**Re-stated, not softened:** nothing here proves the thermal printer, the cash
drawer hardware, MoMo settlement timing, or a real GRA filing — those need the
venue and the people in it. See "Cannot be verified here".

## Live environment smoke (every screen)

23 checks against the running preview with the real imported data — sign in,
Menu Items, Tables, Order History, Ingredient Stock, Purchasing & GRN, Register
shift, Staff, Reports (all time and today), Audit Logs, Kitchen Display,
Settings, Billing config, Recipes & Costing, then the full money cycle: open the
register, ring a sale, take a partial card-free cash payment, refund part of it,
watch the balance, erase the order, confirm the stock came back, close the
drawer. **23/23 pass** after the fixes above.

## Open — known and accepted

| Severity | Item | Why it is still open |
|---|---|---|
| Low | **Attribution when a queue syncs under a different user.** A queued offline order is filed under whoever syncs it (the server correctly ignores the client's `userId`), so a shift change can put another person's sale under your name. | Behaviour is correct for security; the fix is a disclosure in the sync notice ("3 of these were rung up by Ama"). Recommend doing it with the next offline change. |
| Low | **56 blocking `alert()` calls remain** in the manager screens (the till path uses in-app notices). | Blocking modals are finger-hostile on a phone and unreadable while moving. Worth migrating screen by screen; deliberately not swept in one pass to keep this change reviewable. |
| Low | **27 fetch sites inspect the JSON body** (`data.success`/`data.error`) instead of `res.ok`. | Equivalent for this API, since every error carries a JSON body; a non-JSON error page (proxy 502) surfaces as a thrown parse error, which those call sites catch. |
| Info | **Over-receiving is allowed** (received > ordered). | Suppliers deliver extra; the quantity is recorded, not capped. Decide with the accountant whether a tolerance should exist. |
| Info | **The payment retry key lives in a ref**, so a browser reload between attempt and retry starts a new payment attempt. | A reload is an explicit new action; the verify-before-retry check still prevents a double charge in the common case. |
| Info | **Day boundaries follow the server clock** (Ghana is UTC+0, matching the reports' stated basis). | Fine for this deployment; revisit if the app is ever hosted outside UTC+0. |

## Cannot be verified here

- **Hardware**: printers, cash drawer, kitchen docket printing — no device is
  reachable from this environment. The suites assert the software side only and
  say so in their output.
- **The production VPS**: the deploy script's control flow is exercised in a
  sandbox with stubbed system tools; the real run is the operator's.
- **On-device visuals**: there is no browser here, so phone/tablet rendering is
  verified structurally (audit script) and through the compiled CSS, not by eye.
- **Financial or physical certification**: none is claimed. This is an internal
  consistency audit, not an audit opinion, and not evidence for a tax filing.

## Re-running this audit

```sh
npm run test:security      # 149 + 70 + 30 checks, disposable database, production build
npm run audit:responsive   # layout rules, exits 1 on a regression
npm run audit:workflows    # feedback/money-guard rules, exits 1 on a regression
npx eslint src tests scripts --max-warnings=0
npx tsc --noEmit
```

An intentional exception is marked where it lives:

```ts
} catch {
  /* audit-ok: private mode — the control falls back to the default size */
}
```
