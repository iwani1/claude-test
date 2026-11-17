# Guide for AI agents (builders and auditors)

This repository is a production restaurant POS that handles real cash. Read this before
changing or auditing anything.

## Where the truth is

1. **`main` on GitHub is the only source of truth.** Work done only in a local copy, an
   AI sandbox, or directly on the VPS does not exist for audit purposes and will be
   overwritten by the next deploy. Every change reaches `main` through a pull request.
2. **[`docs/FINDINGS.md`](docs/FINDINGS.md) is the current status of every audit
   finding.** Read it first. Dated reports (`docs/AUDIT_*.md`,
   `docs/PRODUCTION_READINESS_*.md`) are historical snapshots; do not edit them to record
   fixes.
3. Security model: [`SECURITY.md`](SECURITY.md). Deployment: [`docs/VPS_DEPLOYMENT.md`](docs/VPS_DEPLOYMENT.md).
   Pilot and on-site gates: [`docs/PILOT_RUNBOOK.md`](docs/PILOT_RUNBOOK.md).

## If you are fixing something

- Name the finding ID in the PR title or body: `Fixes N3`.
- In **the same PR**, update the finding's row in `docs/FINDINGS.md`: status, PR number, and
  how you verified it. Add or extend a test in `tests/` where the fix is testable.
- Do not claim a fix in chat that is not in the PR. If you could only partly fix it, leave
  it **Open** with a note.
- One finding (or one tight group) per PR, so each can be reviewed and reverted alone.

## If you are auditing

- Start from `docs/FINDINGS.md`. **Re-verify every Open and In progress row against the code on
  `main`**: do not trust the register, a PR title, or another agent's claim.
- Record the commit you audited (`git rev-parse --short HEAD`).
- Write the new report as `docs/AUDIT_YYYY-MM-DD.md`, then update the register: new rows get
  the next ID in their series (N…, P…), never reusing IDs. Update the *Last full
  verification* line.
- Never open or copy the contents of the legacy databases referenced by finding N2.

## Checks (all must pass before merge; CI runs them)

```sh
npm ci
npm run lint -- --max-warnings=0
npm run typecheck
npm run build                  # with DATABASE_URL and AUTH_SECRET empty
npm run audit:workflows        # static guards: swallowed errors, money idempotency, menu/API gate parity
npm run audit:responsive
npm run test:legacy-import     # embedded PostgreSQL; works as root or not
npm run test:security          # embedded PostgreSQL; ports 15432 and 3100 free
npm run test:backup && npm run test:deploy && npm run test:monitor   # ops scripts
npm audit --omit=dev           # must report 0 vulnerabilities
```

If a check cannot run in your environment, say so explicitly in the PR or report. Do not
report it as passed.

## House rules for code

- Every API route export goes through `secureRoute` (`src/lib/api.ts`) with an explicit
  permission (`"public"` for login). The one deliberate exception is `GET /api/health`: it is
  public, outside `secureRoute`, and answers only a status and reason code. Keep it that way;
  any new route uses `secureRoute`. Permission questions go through `src/lib/permissions.ts` (effective
  permissions), not role names, except the documented owner-only rules in
  `src/app/api/staff/route.ts`.
- Money is integer minor units (pesewas). The server re-prices every order; never trust
  client totals or "paid" flags.
- Money-moving routes need idempotency keys and row locks. See the pay and refund routes.
- Audit-log writes must record the acting user.
- Schema changes are reviewed SQL in `migrations/` that keep RLS, grants and ownership.
  Never use `drizzle-kit push` against production.
- Never commit `.env`, databases, dumps or ZIP archives.
