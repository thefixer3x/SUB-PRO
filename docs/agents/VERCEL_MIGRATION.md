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
- Catalog convention: price `lookup_key` = `{project}_{tier}_{interval}`. SubTrack's live prices (2026-11-04): Pro $10/month → `subtrack_pro_monthly`, Team $20/month → `subtrack_team_monthly`, both tagged `project=subtrack` with `tier` = `pro` / `team`. Application code resolves prices by lookup key, never by hardcoded ID.
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
  embedded-finance/virtual-cards/[...path].ts
  banking/proxy.ts
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

Route map. Every server route lives under `/api`, and the API base URL includes `/api`, so web (relative) and native (absolute) requests hit the same handler:

| Client request (path after the base) | Web URL | Handler |
|---|---|---|
| `/create-checkout-session` (`hooks/usePayments.ts`) | `/api/create-checkout-session` | `api/create-checkout-session.ts` |
| Stripe → webhook | n/a | `api/stripe/webhook.ts` |
| `/embedded-finance/virtual-cards/*` (`services/virtualCards.ts`) | `/api/embedded-finance/virtual-cards/*` | `api/embedded-finance/virtual-cards/[...path].ts` |
| `/banking/proxy` (`services/mcpBankingService.ts`; change its native constant from `/banking-proxy`) | `/api/banking/proxy` | `api/banking/proxy.ts` |
| `/splitwise` (`services/sharedSubscriptions.ts`) | `/api/splitwise` | `api/splitwise.ts` |
| `/hibp-check` | `/api/hibp-check` | `api/hibp-check.ts` |
| `/embedded-finance/plan/*` (Plan inbox + envelopes) | `/api/embedded-finance/plan/*` | `api/embedded-finance/plan/[...path].ts` |

Any path not in this table must not exist on the client; an unmatched `/api/*` path returns 404 from Vercel (it is excluded from the SPA rewrite), never `index.html`.

Vercel environment (owner sets these; names only, never values in the repo): `STRIPE_SECRET_KEY` (missing on Vercel today), `STRIPE_WEBHOOK_SECRET` (present), `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (present), `ALLOWED_ORIGINS`, `SITE_URL`, `SPLITWISE_API_KEY`, `HAVEIBEENPWNED_API_KEY`, and `CRON_SECRET` (protects the P1 envelope-spend cron). Native clients: `EXPO_PUBLIC_API_BASE_URL=https://sub-pro.lanonasis.com/api` (and the same value for `EXPO_PUBLIC_EMBEDDED_FINANCE_API_BASE_URL`). The `/api` suffix is required: client paths are appended to the base without it. Web uses relative `/api/...` URLs.

## 4. Phase 2: Stripe cutover (owner, about 15 minutes)

1. ~~Add lookup key `subtrack_pro_monthly` to `price_1RiSAL2KF4vMCpn8wUyDio3N`.~~ **Superseded by D4 (2026-11-04):** `subtrack_pro_monthly` is on the active $10 Pro price (`price_1UY1Vm2…`); the $4.99 price is archived. Do not move the key back.
2. Tag endpoint `we_1RiSB62…` with `metadata.project = subtrack`. Re-list SubTrack prices and confirm each carries `metadata.project = subtrack` (checked 2026-11-03: Pro monthly `price_1RiSAL2…`, Enterprise monthly `price_1RiSAi2…` and the legacy one-time Pro price are all tagged; the Basic product has no price). ~~Add lookup key `subtrack_enterprise_monthly` to the Enterprise price as well.~~ Superseded by D4: the second tier is Team, `subtrack_team_monthly` on `price_1UY1Vo2…` ($20); the $9.99 Enterprise price is archived.
3. After the Vercel preview passes a Stripe **test-mode** run (checkout → webhook → tier shown in app), change the endpoint URL to `https://sub-pro.lanonasis.com/api/stripe/webhook`. The signing secret does not change, and Vercel already holds it.
4. Send a test event from the Stripe dashboard and confirm a 200 in Vercel function logs.
5. Rollback: set the endpoint URL back to the Netlify address. Both handlers share `server/`, so behaviour is identical.

**Owner decision (2026-11-03): two entitlement sources, kept separate.**
- SubTrack keeps its own tier in `profiles.subscription_tier`, written only by SubTrack's webhook for prices tagged `metadata.project = subtrack` (option b). SubTrack never reads VortexCore's `user_tiers` / `stripe_subscriptions`.
- A SubTrack subscription must not grant, change or revoke VortexCore entitlements. VortexCore's `stripe-entitlements` currently maps the SubTrack price ids to `pro`/`enterprise`; that is fixed in the vortex-core-app repo (filter on `metadata.project = 'vortexcore'`), not here.

## 5. Phase 3: retire Netlify

After 7 days of clean webhook deliveries on Vercel and at least one successful real checkout:

1. `git mv netlify/ netlify.toml docs/archive/netlify/`.
2. Keep installed apps working. Native builds keep the API base URL they were built with, which may point at `subtrack-pro.lanonasis.com/.netlify/functions`, and `app.json` registers `subtrack-pro.lanonasis.com` for deep links (`applinks`, Android intent filter). So:
   - Add `subtrack-pro.lanonasis.com` to the Vercel project as a domain that **serves** the app (not a 301: a redirect turns POSTs into GETs and breaks checkout and webhooks).
   - Add `vercel.json` rewrites from the legacy paths to the new handlers: `/.netlify/functions/create-checkout-session` → `/api/create-checkout-session`, `/.netlify/functions/banking-proxy` and `/banking-proxy` → `/api/banking/proxy`, `/.netlify/functions/embedded-finance-virtual-cards/:path*` and `/embedded-finance/virtual-cards/:path*` → `/api/embedded-finance/virtual-cards/:path*`, `/stripe/webhook` → `/api/stripe/webhook`.
   - Serve `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json` from Vercel on both hosts, and add `sub-pro.lanonasis.com` to `app.json` associated domains in the next native build.
   - Keep these rewrites until every supported native build uses the new base URL (owner sets the support window; check the EAS `EXPO_PUBLIC_*_BASE_URL` values per environment first).
3. Owner: then stop Netlify builds for the `subtrack-pro` site; its DNS now points at Vercel.
4. Remove Netlify from `.easignore`/docs, update `WORKER_GUIDE.md` section 1, and drop the Netlify deploy-preview status check from branch protection.

## 6. Cards

M00–M05 in `CARDS.md` cover this plan. C02, C06 and C08 now target `api/` + `server/` instead of `netlify/functions/`.
