# Worker guide for coding agents

Read this before picking up any card from `docs/agents/CARDS.md`. It applies to every agent (Hermes workers, Claude Code, Codex, others) and to humans pairing with them.

## 1. How the system is wired (read first)

| Piece | Where | Notes |
|---|---|---|
| Web app (production) | Vercel project `sub-pro` → `sub-pro.lanonasis.com` | **Static SPA only** (`app.json` `web.output: "single"`, publishes `dist/`). Nothing under `app/api/**` is served. |
| Server code | Netlify site `subtrack-pro` → `subtrack-pro.lanonasis.com` | `netlify/functions/*.ts`: checkout, Stripe webhook (`/stripe/webhook`), banking proxy, virtual cards. Vercel rewrites `/api/create-checkout-session` here. |
| Mobile | EAS (`eas.json`, `.github/workflows/enhanced-eas-build.yml`) | Committed `android/` and `ios/` (non-CNG): `app.json` native fields are ignored unless mirrored there. |
| Database | Supabase project `mxtsdgkwzjzlttpotole` (custom domain) | **Shared with other apps.** This app's tables are prefixed `sm_` plus `virtual_cards`, `card_authorizations`, `profiles`. `supabase/migrations/` does **not** match production (#37). |
| Payments | Stripe live account, webhook `we_1RiSB62KF4vMCpn8afHaBbrF` → Netlify `/stripe/webhook` | |

Tracker of all findings: issue #44. Audit reports: `docs/security/audits/2026-10-29/` (read the "Reviewer errata" in its README; some audit claims are wrong).

## 2. Hard rules (any violation = card rejected)

1. **Public repository.** Never write secrets, tokens, keys, `whsec_` values, passwords, personal emails or local machine paths into code, commits, PRs, issues, card comments or logs. Use env var *names* only.
2. Never use or create `EXPO_PUBLIC_*SECRET*` / `EXPO_PUBLIC_*SERVICE_ROLE*` variables. Anything `EXPO_PUBLIC_*` ships to every browser and phone.
3. **No production changes from an agent:** no SQL writes or migrations on the live database, no Stripe live-mode writes, no env var edits on Vercel/Netlify/EAS, no key rotation, no DNS/domain changes. If a card needs one, write the change as a file (SQL in `supabase/proposed/`, steps in the PR body) and mark the card **blocked: needs owner**.
4. Never disable RLS, weaken a policy, or add mock/demo auth to make something work.
5. No force-push, no history rewrite, no `--no-verify`. One branch and one PR per card.
6. Do not edit files outside your card's **Scope** list unless the card says so. If you must, explain why in the PR.
7. No exploit recipes in public text. Describe the fix, not how to abuse the bug.
8. Do not touch `android/`, `ios/`, `eas.json` or `.github/workflows/` unless your card is about them.

## 3. Workflow per card

```bash
git fetch origin main
git checkout -b agent/<card-id>-<short-slug> origin/main   # e.g. agent/c01-virtual-cards-auth
npm ci
```

1. Read the linked GitHub issue and the files in **Scope**. Confirm the problem still exists on `main`; if it is already fixed, complete the card with evidence and stop.
2. Make the smallest change that meets **Done when**. Add or update tests next to the code (`__tests__/` or `*.test.ts`).
3. Run the checks below. All must pass.
4. Commit with a conventional message (`fix(netlify): ...`), push, open a PR titled `[Cxx] <card title>` whose body has: summary, `Fixes #<issue>`, the checks you ran with results, and any owner action needed.
5. Post the handoff on the card (section 5) and move it to review.

## 4. Required checks (paste results in the PR)

```bash
npm run type-check
npm run lint
npx jest --testPathIgnorePatterns '/.claude/'
npx expo export -p web --output-dir /tmp/sub-pro-web   # only if you changed app/, components/, hooks/, services/ or config
```

For Netlify function changes also run `npx tsc --noEmit -p .` (included in type-check) and add a unit test that calls the handler with: no `Authorization` header (expect 401), a bad token (expect 401), and a valid mocked user (expect success). Mock Supabase and Stripe; never call live services from tests.

## 5. Handoff evidence (card comment + PR)

- **Changed:** files and one line on what each change does.
- **Verified:** the commands from section 4 and their results; test names added.
- **Owner action:** anything only the owner can do (env var, SQL apply, dashboard click), or "none".
- **Residual risk:** what is still open.

No secrets or raw logs in comments; summarise.

## 6. Shared building blocks

- Auth for Netlify functions: follow `netlify/functions/banking-proxy.ts` (Supabase `auth.getUser(token)` from the `Authorization: Bearer` header). Card C01 extracts this into `netlify/functions/_shared/auth.ts` plus a CORS allowlist helper; later function cards must reuse it, not copy it.
- CORS allowlist comes from env `ALLOWED_ORIGINS` (comma-separated). Default for local dev only: `http://localhost:5000`.
- Server-side Supabase: `services/database.ts` uses the service-role key. Import it only from `netlify/functions/**`.

## 7. When stuck

Block the card with a concrete reason (`hermes kanban block <id> --reason "..."`), comment what you tried, and stop. Do not widen scope to get unstuck.
