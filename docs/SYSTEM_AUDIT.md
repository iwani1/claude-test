# System audit — 12 October 2026

A full pass over the running system: every API route, every screen, the money
paths, the stock paths, the offline layer and the deployment tooling. It is
written to be checkable rather than reassuring — each claim below names the
evidence, and everything still open is listed as open.

**Audited at:** `8e402e9` (branch `arena/181e4004-claude-test`)
**Performed by:** the agent, from the repository and a disposable PostgreSQL —
not from the production server, not with a browser, not with hardware.

## How it was done

| Method | What it covered |
|---|---|
| `npm run test:security` | 149 security + 70 pilot + 30 accounting checks against a disposable database and a production build |
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
| **Medium** | 8 screens swallowed load failures (`console.error` only), so a broken connection looked like "no stock", "no sales", "no staff". | `LoadFailure` strip with a 44px Retry on every one of them. |
| **Medium** | A failed sign-out was silent: the screen cleared while the session cookie could still be alive — dangerous on a shared terminal. | Sign-out now reports the failure and asks for a retry once connected. |
| **Low** | The stock-adjustment submit button was a 28px target (below the touch floor) and could be double-tapped. | 44px minimum, in-flight guard, "Committing…" state. |
| **Low** | An offline payment notice promised "it will not be charged twice" before the server could guarantee it. | The promise is now backed by payment idempotency, and the notice points at the safe action (retry, or check Order History). |

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
