# Agent work cards

Each card is one objective. Read `docs/agents/WORKER_GUIDE.md` first; its rules override anything here. Card IDs (C01…) are stable; Hermes card titles start with them. `scripts/hermes/seed-cards.sh` creates these cards on a Hermes Kanban board.

**Roles:** `builder` writes code, `reviewer` reviews PRs against the guide, `qa` runs end-to-end checks. **Owner** = the human account holder (dashboards, secrets, production DB).

**Waves:** cards in a wave can run in parallel. A card with **Depends on** starts only when that card's PR is merged.

---

## Wave 1: security fixes in server code

### C01: Require login on the virtual-cards function (#27, P0)
- **Role:** builder
- **Scope:** `netlify/functions/embedded-finance-virtual-cards.ts`, new `netlify/functions/_shared/auth.ts`, new `netlify/functions/_shared/cors.ts`, tests.
- **Do:** extract the bearer-token check from `banking-proxy.ts` into `_shared/auth.ts` (returns the Supabase user or a 401 response). Add `_shared/cors.ts` (origin allowlist from `ALLOWED_ORIGINS`, handles `OPTIONS`). In virtual-cards: require auth, take the user id only from the session, ignore any `userId` in the body or query, check `virtual_cards.user_id` before every read or update, and validate or escape values used in Stripe search queries. Remove the hardcoded `123 Main St` billing address: use the profile's address, or return 400 if it is missing.
- **Done when:** tests cover no token → 401, bad token → 401, another user's card → 403/404, and own card → 200. Wildcard CORS is gone from this file.
- **Owner action before merge:** set `ALLOWED_ORIGINS` on Netlify (e.g. `https://sub-pro.lanonasis.com,https://subtrack-pro.lanonasis.com`). Do not merge or deploy C01 until it is set, or browser requests from the production app fail the CORS preflight.

### C02: Require login on checkout and lock down CORS (#28, P1)
- **Role:** builder · **Depends on:** C01 (reuse `_shared/auth.ts` and `_shared/cors.ts`)
- **Scope:** `netlify/functions/create-checkout-session.ts`, `netlify/functions/banking-proxy.ts`, `hooks/usePayments.ts`, tests.
- **Do:** checkout derives `userId` and `email` from the verified session and ignores body values. `hooks/usePayments.ts` sends `Authorization: Bearer <session access_token>`. Validate the success/cancel URL origin against the allowlist. Switch banking-proxy to the shared CORS helper.
- **Done when:** tests prove a body `userId` and a body `email` that differ from the session are both ignored, and `Access-Control-Allow-Origin: *` no longer appears in `netlify/functions/`.

### C03: Locked-down Claude GitHub workflows (#29, P1)
- **Role:** builder
- **Scope:** `.github/workflows/claude.yml`, `.github/workflows/claude-code-review.yml`.
- **Do:** run only when `author_association` is OWNER, MEMBER or COLLABORATOR. Pin `anthropics/claude-code-action` to a release tag or SHA. Drop `id-token: write` unless the action docs require it. Set least-privilege `permissions`.
- **Done when:** the workflows pass `actionlint` (or a YAML lint) and the PR body explains each permission.

### C04: Security headers, CSP in report-only mode (#30, P1)
- **Role:** builder
- **Scope:** `vercel.json`, `netlify.toml`.
- **Do:** for all paths add `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera, mic and geolocation off), and `Content-Security-Policy-Report-Only` allowing self, the Supabase custom domain, `*.stripe.com`, `js.stripe.com` and Sentry ingest. Keep the existing rewrites unchanged.
- **Done when:** after the preview deploy, `curl -sI <preview-url>` shows the headers (paste the output), and the app still loads and signs in on the preview with no CSP-blocked requests that break the page.

## Wave 2: make the product real

### C05: Real subscriptions and dashboard data (#33, P1)
- **Role:** builder
- **Scope:** `hooks/useSubscriptions.ts`, `app/(tabs)/index.tsx`, `data/mockData.ts` (demo only), related components and tests.
- **Do:** load the signed-in user's rows from `sm_subscriptions` through the existing Supabase client (RLS scopes to the user). Compute monthly and annual totals, renewals in the next 7 days, and recent activity from those rows. Add loading, empty and error states. Mock data is allowed only when demo mode is explicitly on (`scripts/toggle-demo-mode.sh`).
- **Done when:** a new user sees an empty state, not fake data, and tests cover the totals maths.

### C06: One reliable Free→Pro upgrade flow (#34, P1)
- **Role:** builder · **Depends on:** C02
- **Scope:** `hooks/usePayments.ts`, `services/stripe.ts`, `hooks/useSubscription.tsx`, `components/monetization/*`, `netlify/functions/stripe-webhook.ts`, success/cancel screens.
- **Do:**
  - Use exactly one checkout endpoint (`/api/create-checkout-session` → Netlify) and remove the dead `/api/stripe/create-checkout-session` call.
  - Read tier from one source of truth, written only by the webhook through the service role.
  - Make the fallback `canAccessFeature` deny by default.
  - After returning from checkout, refresh the subscription state.
  - Handle `checkout.session.completed` in the webhook if needed. Stripe already sends it; today it is logged and ignored.
- **Done when:** a Stripe **test-mode** walkthrough (free → checkout → webhook → Pro shown in app) is documented in the PR with screenshots. Use test keys locally, never live.

### C07: Hide fake credit approvals (#39, P2)
- **Role:** builder
- **Scope:** `services/embeddedCredit.ts`, `components/embeddedFinance/EmbeddedCreditView.tsx`, `services/communityStats.ts`.
- **Do:** put embedded credit behind a feature flag that is off by default and show a "coming soon" state. Add a consent check inside `contributeToCommunityStats`.
- **Done when:** no code path can display a simulated approval when the flag is off, and a test proves it.

### C08: Move Splitwise and HIBP calls server-side (#35, P2)
- **Role:** builder · **Depends on:** C01
- **Scope:** `services/splitwise.ts`, `config/compliance.ts`, new Netlify function(s), tests.
- **Do:** create an authenticated Netlify function that holds `SPLITWISE_API_KEY` and `HAVEIBEENPWNED_API_KEY` server-side, and have the client call it. **Do not** rename these keys to `EXPO_PUBLIC_*`.
- **Done when:** a grep for these key names in client code (app/, components/, hooks/, services/, config/) returns nothing, and the function tests pass.
- **Owner action:** set both keys on Netlify.

## Wave 3: database and platform (needs owner)

### C09: Write the live-DB permission fixes as a reviewable SQL file (#31, P1)
- **Role:** builder (writes the file only) → **Owner** applies it
- **Scope:** new `supabase/proposed/2026-11-sm-permissions.sql`, plus a README note.
- **Do:**
  - Revoke `EXECUTE` on `public.sm_update_feature_flag` from `PUBLIC, anon, authenticated` and grant it to `service_role`.
  - Replace the owner `ALL` policies on `sm_subscriptions` and `virtual_cards` with owner `SELECT`.
  - Include a rollback block.
  - **Do not run it.** Confirm first that C06's webhook writes use the service role, so the new policies don't break upgrades.
- **Done when:** the PR contains the SQL plus a rollback, and the card is blocked with "needs owner: apply".

### C10: Expo Doctor patch alignment (#40, P2)
- **Role:** builder
- **Scope:** `package.json`, `package-lock.json`, `app.json` (and `android/` and `ios/` only if needed).
- **Do:** run `npx expo install --fix` and then `npx expo-doctor`. Record which `app.json` native fields differ from `android/` and `ios/`. Don't switch to CNG in this card; write it up as a proposal in the PR.
- **Done when:** `expo-doctor` is clean (or remaining warnings are explained), the web build passes, and an EAS Android preview build is triggered by the owner.

### C11: CI supply chain (#38, P2)
- **Role:** builder · **Depends on:** C03 (same files)
- **Scope:** `.github/workflows/*`, new `.github/dependabot.yml`, new CodeQL workflow.
- **Do:** pin actions to SHAs, add Dependabot (npm and github-actions) and CodeQL, replace the no-op audit step with `npm audit --omit=dev --audit-level=high` (non-blocking), and set top-level `permissions: contents: read`.
- **Done when:** all workflows are green on the PR.
- **Owner action:** enable secret scanning and push protection in repo settings.

### C12: Retire the unserved `app/api` routes (#36, P2)
- **Role:** builder
- **Scope:** `app/api/**`, and any client code that calls those paths.
- **Do:** list each route and whether anything calls it. Move dead routes to `docs/archive/legacy-app/api/` with `git mv`. For live features, point the client at the Netlify equivalent, or open a follow-up card. Remove the vendor-password collection flow (`CancellationBot`) from the UI.
- **Done when:** `app/api` contains no route that trusts client ids without auth, and the web build passes.

### C13: Hardening bundle (#41, P3)
- **Role:** builder
- **Scope:** per item in #41.
- **Do:**
  - Add an ESLint `no-restricted-imports` rule for `services/database` outside `netlify/functions`.
  - Strip `console.log` in production builds and remove logs that print ids.
  - Move `stripe` to `dependencies`.
  - Use `read -s` in the `scripts/setup-*.sh` scripts.
  - Leave OTA signing and ESLint major versions as notes.
- **Done when:** lint and tests pass, and each sub-item is ticked in the PR.

## Review and QA (one per merged PR)

### R00: Review each agent PR
- **Role:** reviewer
- **Do:** check the PR against `WORKER_GUIDE.md` section 2 (hard rules), confirm the checks were run, and look for secrets, scope creep and missing tests. Approve, or request changes with specific lines.

### Q01: End-to-end smoke test after Wave 2
- **Role:** qa · **Depends on:** C05, C06
- **Do:** on the Vercel preview, sign up → add a subscription → dashboard totals update → upgrade with a Stripe test card → Pro unlocks. Record a Jam or screenshots and file issues for anything broken.

## Owner-only (not cards for agents)

- Make sure Netlify has `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (the same signing secret as webhook `we_1RiSB…`), `STRIPE_PRICE_PRO_MONTH`, `SITE_URL` and `ALLOWED_ORIGINS`.
- Accept the Apple developer agreement. Create the new Google Play account after the rebrand (#42, #43).
- Apply C09's SQL after review. Baseline migrations with `supabase db pull` (#37).
