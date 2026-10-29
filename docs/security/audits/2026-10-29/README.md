# Security and configuration audits - 2026-10-29

Four audit reports were produced on 2026-10-29. They are stored here as **redacted copies**:

| File | Scope |
|---|---|
| `data-layer-rls-audit.md` | Services, data layer and Row Level Security posture |
| `configuration-audit.md` | Configuration audit (28 findings) |
| `remediation-report.md` | Remediation guidance for the top findings |
| `cicd-audit.md` | CI/CD, headers, CORS and supply chain (20 findings) |

Notes:

- Secrets (an EAS robot token), personal email addresses and local filesystem paths were replaced with `<REDACTED: ...>` / `<local-path>` placeholders.
- "Safe Reproduction" blocks were removed from the public copy until the underlying findings are fixed.
- The auditors scanned an older snapshot of a monorepo copy of this project (`apps/SUB-PRO`). File paths and line numbers may be stale, and some findings (for example monorepo-only `.archive/` env files or the bun lockfile) do not apply to this repository.
- Every finding that applies to this repository is tracked as a GitHub issue: see the tracker, https://github.com/thefixer3x/SUB-PRO/issues/44. Findings that were stale or not applicable to this repository are listed there with reasons.

## Reviewer errata (read before acting on a report)

These are third-party reports, kept as delivered apart from redaction. Where a report's claim or example is wrong, the correction lives here and in the linked GitHub issue, not in the report text. Known corrections:

- **Configuration audit, executive summary:** not all four Netlify functions lack auth. `banking-proxy` verifies a Supabase bearer token, and `stripe-webhook` verifies Stripe signatures. The unauthenticated ones are tracked in #27 and #28.
- **Configuration audit, F09:** `eas.json` holds identifiers and a key-file path, not the private key. The `.p8` is gitignored and written from a CI secret. The owner Apple IDs were removed in this PR. Identifiers and a key-file path do not show that the private key was exposed: rotate the App Store Connect key only if a check of git history finds the `.p8` contents.
- **Configuration audit, F11:** pin `search_path` as a function attribute (`... RETURNS ... SET search_path = '' AS $$`), not as a statement inside the PL/pgSQL body. Prefer an empty or `pg_catalog`-only path with schema-qualified references over `public`.
- **Configuration audit, test plan:** TC012 should assert that the deletion response does **not** contain the confirmation token. TC015 should expect `401` without auth. TC008/TC009 should target `/stripe/webhook`, which is what Netlify routes.
- **Data-layer audit, F1/F4:** Metro inlines only `EXPO_PUBLIC_*` variables, so `SPLITWISE_API_KEY` and `HAVEIBEENPWNED_API_KEY` are `undefined` in the client bundle. That is a broken feature, not a key leak (#35).
- **Data-layer audit, F5:** with no permissive INSERT policy, client inserts into `card_authorizations` are already denied. Row-security policies cannot reference `NEW`.
- **Data-layer audit, F7:** the `USING (auth.uid() = user_id)` policy already blocks cross-user updates and reassignment. The real gap is owners editing their own `status`, `plan_name` and price columns (#31, #34).
- **Data-layer audit, positive controls:** the repo migrations are not fully replay-safe; `20250902_complete_schema.sql` has unguarded `CREATE POLICY`. These migrations are not what production runs either (#37).
- **Remediation report:** the `.gitignore` example with `*.png` would also ignore app assets, and `!assets/images/` does not re-include the files inside it. The `netlify.toml` header example needs a `[[headers]]` table with `for = "/*"`, and its CSP is missing the closing quote on `object-src 'none'`. The CORS example should echo the origin only when it is on the allowlist. `eas.json` does not expand `$VAR` in submit fields. Do not run the force-push history rewrite: revoking the token is what neutralises it.
