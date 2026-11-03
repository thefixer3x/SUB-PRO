# Plan: make Vercel the only web and payments host, retire Netlify

Status: proposed (2026-11-03). Owner decision recorded: Vercel (`sub-pro.lanonasis.com`) is the canonical web host. Netlify (`subtrack-pro.lanonasis.com`) is deprecated once its server functions run on Vercel.

## 1. Where things are today

| Piece | Today | Target |
|---|---|---|
| Web app | Vercel static SPA (`dist/`) | unchanged |
| Checkout | Vercel rewrites `/api/create-checkout-session` to a Netlify function | Vercel function `api/create-checkout-session.ts` |
| Stripe webhook | Endpoint `we_1RiSB62KF4vMCpn8afHaBbrF` → `subtrack-pro.lanonasis.com/stripe/webhook` (Netlify) | `sub-pro.lanonasis.com/api/stripe/webhook` (Vercel) |
| Virtual cards, banking proxy, HIBP, Splitwise | Netlify functions | Vercel functions under `api/` |
| Mobile apps | call `EXPO_PUBLIC_*_API_BASE_URL` | same variables, pointed at `https://sub-pro.lanonasis.com` |

Shared context that constrains the design (see the VortexCore Stripe catalog notes held by the owner):

- One Stripe account serves several projects. Webhooks receive **every** project's events, so SubTrack's handler must ignore events for prices whose `metadata.project` is not `subtrack`.
- Catalog convention: price `lookup_key` = `{project}_{tier}_{interval}`. SubTrack's live price `price_1RiSAL2KF4vMCpn8wUyDio3N` ($4.99/month) is tagged `project=subtrack, tier=pro` but has **no lookup key yet**. Target key: `subtrack_pro_monthly`. Application code resolves prices by lookup key, never by hardcoded ID.
- One webhook endpoint per project, tagged `metadata.project`. `we_1RiSB62…` is SubTrack's and is not tagged yet.
- The Supabase project is shared. VortexCore's `stripe-entitlements` function already writes `public.user_tiers` and `public.stripe_subscriptions` for **all** subscriptions on the account, including SubTrack's (legacy SubTrack prices resolve to `pro` there). Never deploy a Supabase function named `stripe-webhook` from any repo; that name belongs to the Stripe Sync Engine.

## 2. Phase 0: fix drift before porting anything

These must land first, or the port copies broken code.

1. **`virtual_cards` column.** Production has `card_id` (plus `cardholder_id`); there is no `stripe_card_id` column. Commit `9b4d7cd` on `main` renamed the insert in `services/database.ts` to `stripe_card_id`, so card reference inserts now fail. `card_authorizations.stripe_card_id` is correct and must stay. Fix the insert and the `virtual_cards` types in `lib/supabase.ts`; prefer regenerating types from the live schema.
2. **`profiles.billing_address` does not exist** in production. Any code that reads it fails every card creation. Either the owner approves a migration adding it (reviewed SQL in `supabase/proposed/`), or card creation takes a validated address from the request and stores nothing.
3. **Merge order.** C08's `netlify/functions/hibp-check.ts` and `splitwise-api.ts` landed on `main` before C01's shared helpers, and import `../_shared/*` (wrong path) and `@netlify/functions` (not installed). They do not type-check. Port them straight to Vercel in Phase 1 instead of fixing them on Netlify.
4. **PRs #57 and #59 are two divergent copies of the same files.** Consolidate them into one PR (card M00) before any further work.

## 3. Phase 1: Vercel functions

Layout:

```
api/
  create-checkout-session.ts
  stripe/webhook.ts
  virtual-cards/[...path].ts
  banking-proxy.ts
  hibp-check.ts
  splitwise.ts
server/            # shared, runtime-agnostic, never imported by app code
  auth.ts          # bearer token -> Supabase user (401 bad token, 503 auth outage)
  cors.ts          # ALLOWED_ORIGINS allowlist
  stripe.ts        # client + lookup_key price resolution + project filter
  supabase-admin.ts
```

Rules:

- Use Web-standard handlers (`export async function POST(request: Request)`). The webhook reads the raw body with `await request.text()` before `stripe.webhooks.constructEvent`; never parse JSON first.
- `server/` holds the logic once. During the overlap the Netlify functions become thin adapters that call `server/`, so both hosts run identical code.
- `vercel.json`: delete the `/api/create-checkout-session` → Netlify rewrite, and exclude `api/` from the SPA catch-all rewrite (`/((?!api/|_expo|static|favicon.ico|manifest.json|service-worker.js).*)`). Keep the security headers from C04.
- `.vercelignore` must not exclude `api/` or `server/`. ESLint `no-restricted-imports` must forbid importing `server/` or `services/database` from `app/`, `components/`, `hooks/`.
- Webhook handler: skip (return 200) any subscription or invoice event whose price `metadata.project !== 'subtrack'`. Log the skip. Handle `checkout.session.completed` idempotently.
- Checkout: resolve the price with `stripe.prices.list({ lookup_keys: ['subtrack_pro_monthly'] })`; derive user id and email from the verified session only.

Vercel environment (owner sets these; names only, never values in the repo): `STRIPE_SECRET_KEY` (missing on Vercel today), `STRIPE_WEBHOOK_SECRET` (present), `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (present), `ALLOWED_ORIGINS`, `SITE_URL`, `SPLITWISE_API_KEY`, `HAVEIBEENPWNED_API_KEY`. Mobile and web clients: `EXPO_PUBLIC_API_BASE_URL=https://sub-pro.lanonasis.com`.

## 4. Phase 2: Stripe cutover (owner, about 15 minutes)

1. Add lookup key `subtrack_pro_monthly` to `price_1RiSAL2KF4vMCpn8wUyDio3N` (additive; nothing reads it until the new checkout ships).
2. Tag endpoint `we_1RiSB62…` with `metadata.project = subtrack`.
3. After the Vercel preview passes a Stripe **test-mode** run (checkout → webhook → tier shown in app), change the endpoint URL to `https://sub-pro.lanonasis.com/api/stripe/webhook`. The signing secret does not change, and Vercel already holds it.
4. Send a test event from the Stripe dashboard and confirm a 200 in Vercel function logs.
5. Rollback: set the endpoint URL back to the Netlify address. Both handlers share `server/`, so behaviour is identical.

**Owner decision needed: one entitlement source or two.**
- (a) Recommended: SubTrack reads entitlements from `public.user_tiers` / `public.stripe_subscriptions`, which VortexCore's `stripe-entitlements` already maintains for every subscription on the account. SubTrack's webhook then only handles Issuing events, and the cross-project "one profile, honoured everywhere" rule holds automatically.
- (b) SubTrack keeps writing `profiles.subscription_tier` itself, with the project filter above.
- Either way, note the current VortexCore mapping: a $4.99 SubTrack Pro subscription resolves to VortexCore `pro` ($29.99) entitlements. Confirm that is intended.

## 5. Phase 3: retire Netlify

After 7 days of clean webhook deliveries on Vercel and at least one successful real checkout:

1. `git mv netlify/ netlify.toml docs/archive/netlify/`.
2. Owner: stop Netlify builds for the `subtrack-pro` site and point `subtrack-pro.lanonasis.com` at a 301 redirect to `sub-pro.lanonasis.com` (Vercel domain redirect, or DNS).
3. Remove Netlify from `.easignore`/docs, update `WORKER_GUIDE.md` section 1, and drop the Netlify deploy-preview status check from branch protection.

## 6. Cards

M00–M05 in `CARDS.md` cover this plan. C02, C06 and C08 now target `api/` + `server/` instead of `netlify/functions/`.
