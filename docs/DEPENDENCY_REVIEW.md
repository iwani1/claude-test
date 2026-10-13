# Dependency advisory review — 2026-10-09

Production-only audit: **0 reported vulnerabilities** at local verification.
Full development-inclusive audit: **9 affected package entries** (5 high,
4 moderate) spanning two underlying advisory chains. These are not suppressed.
Re-run audits on the exact lockfile before release; counts can change upstream.

| Advisory | Dependency path | Assessment / control |
|---|---|---|
| [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) — braces nested-pattern denial of service | eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces | Developer lint/config traversal. Do not accept untrusted glob/config inputs or expose tooling as a service. Published braces version checked was 3.0.3; audit marks the available version affected. No compatible patched version was identified. |
| [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99) — esbuild development-server cross-origin exposure | drizzle-kit → @esbuild-kit/esm-loader → @esbuild-kit/core-utils → esbuild | Development schema tooling. The app/migration runner does not start this esbuild server; migration uses reviewed SQL through pg/tsx. Do not expose esbuild serve or Drizzle Studio. |

Updated drizzle-kit from 0.31.10 to the published 0.31.11 patch; the transitive
advisory remains. `npm audit fix --force` proposes older incompatible Next ESLint
and Drizzle toolchains; it was deliberately not used. Unverified major-version
transitive overrides were not applied merely to make the report green.

## Release decision

This is a documented, **pending owner acceptance**, tooling-only risk exception,
not a claim that all dependencies are safe. Production dependency audit remains
a blocking CI gate. Run builds/lint in isolated CI with no production database
or secret access; production runtime should omit build tools where deployment
packaging permits. Review both chains again within 30 days or when patched
compatible versions become available. The site owner/security maintainer must
accept or reject this exception before production rollout.
