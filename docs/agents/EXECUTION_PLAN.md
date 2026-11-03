# Execution plan: Sprints 1–4 (runbook for Hermes workers)

**Status:** active from 2026-11-03. **This file is the only source of open work.** `CARDS.md` is history: cards there that are not listed below are done or folded into a card here. If this file and `CARDS.md` disagree, this file wins. `WORKER_GUIDE.md` rules still apply to every card and override anything here.

**Orchestrator:** Claude Code reviews every PR against the card's **Accept when** list before anything merges. Workers never merge.

---

## 0. How to run a card (read once)

1. **Pick up only a card whose `Depends on` cards are merged on `main`.** Hermes keeps blocked cards in `todo` through `--parent`; do not work around that.
2. Branch from fresh `main`, named exactly `agent/<card-id-lowercase>-<slug>`. For example: `agent/s102-shared-groups-gate`.
3. Run `npm ci` (the lockfile is tracked now; never run `npm install <pkg>` unless the card's **Scope** lists `package.json`).
4. **Change only files in Scope.** If you need another file, stop, and block the card with the reason.
5. Run the checks in section 4 of the worker guide. Then open the PR:
   - **Title:** `[S1xx] <card title>`.
   - **Body:** the handoff template in section 3 of this file.
6. **Block, don't guess.** Ambiguity, a missing owner decision or a failing check you can't fix in scope all mean the same thing:
   - block with `kanban_block`;
   - give a one-line reason;
   - stop.

### Definition of done (every card)

All seven must hold; "mostly" is a rejection.

1. Every **Accept when** item is met, and the evidence is in the PR.
2. `npm run type-check`: **zero** errors.
3. `npm run lint`: 0 errors.
4. `npx jest --testPathIgnorePatterns '/.claude/'`: all pass, with the new tests named in the PR.
5. Web export passes if `app/`, `components/`, `hooks/`, `services/` or config changed.
6. Hard rules (worker guide section 2) hold:
   - no secrets, emails or local paths;
   - no `EXPO_PUBLIC_*SECRET*`;
   - no production writes;
   - no new mock data in a non-demo path.
7. The diff contains nothing outside Scope.

---

## 1. Already done (do not redo)

| Item | Where |
|---|---|
| C01 virtual-cards auth, M00 consolidation, M01 `card_id` drift, C03 workflow lockdown, C04 headers | PR #61, landed with the Sprint 0 PR |
| Card-update control validation, `weavr` → 501, Stripe category fix on create | Sprint 0 PR (orchestrator) |
| `package-lock.json` tracked; Dependabot ignores Expo-pinned packages | Sprint 0 PR (orchestrator) |
| C10, C11, C12, C13 | on `main` |
| C08 | on `main` but did not compile; Sprint 0 PR makes it compile safely (HIBP checks only the signed-in user's email; Splitwise returns 501). **S203 still rebuilds both on Vercel** |

---

## 2. Owner decisions and actions (cards wait on these)

| ID | Decision or action | Blocks | Default if no answer |
|---|---|---|---|
| D1 | Entitlement source: (a) read `public.user_tiers` / `stripe_subscriptions` written by VortexCore's `stripe-entitlements` [recommended], or (b) SubTrack writes `profiles.subscription_tier` with a project filter | S201, S202 | none; S201 stays blocked |
| D2 | Is a $4.99 SubTrack Pro subscription meant to grant VortexCore `pro` entitlements? | S202 | treated as a bug to report, not fix |
| D3 | Billing address: keep it per request (current), or approve a column migration | S304 | per request |
| A1 | Netlify env: `ALLOWED_ORIGINS=https://sub-pro.lanonasis.com,https://subtrack-pro.lanonasis.com` | production card calls from the browser | — |
| A2 | Vercel env: `STRIPE_SECRET_KEY`, `ALLOWED_ORIGINS`, `SITE_URL` (`STRIPE_WEBHOOK_SECRET`, `SUPABASE_SECRET_KEY` already set) | S201 preview test | — |
| A3 | Stripe: lookup keys `subtrack_pro_monthly` (`price_1RiSAL2…`) and `subtrack_enterprise_monthly` (`price_1RiSAi2…`) | S201 | orchestrator can add these via the Stripe connector on request (additive) |
| A4 | Top up the Anthropic key used by the `claude-review` workflow | automated review | — |
| A5 | `SPLITWISE_API_KEY`, `HAVEIBEENPWNED_API_KEY` on Vercel | S203 preview test | — |

**Decisions log.** Only the orchestrator edits this list, and only after the owner answers. A worker whose card depends on a D or A item checks here first; if the item is still open, the worker blocks the card with `needs owner: <ID>`.

- D1: open
- D2: open
- D3: open (default "per request" applies)
- A1–A5: open

---

## 3. Handoff template (paste into the PR and the card)

```
Card: S1xx  ·  Branch: agent/s1xx-...  ·  Fixes #<issue or "none">
Changed:
- <file> — <one line>
Accept-when evidence:
- [x] <criterion 1> — <test name / screenshot / command output summary>
Checks: type-check <result> · lint <result> · jest <N passed> · web export <ok/n.a.>
Owner action: <none | exact action>
Residual risk: <what is still open>
```

---

## Sprint 1: stop showing fake or unsafe things (UI only, no backend)

All four cards run **in parallel**. None touches `netlify/`, `api/` or `server/`.

### S101: Sign Out in Settings (P1)
- **Role:** builder · **Depends on:** none · **Issue:** report item 1
- **Scope:** `app/(tabs)/settings.tsx`.
- **Do:**
  1. Cherry-pick commit `28de5ac` from `origin/claude/port-pr-12-signout` onto your branch. It adds a "Sign Out" row that calls the auth context's sign-out.
  2. Confirm sign-out clears the session and routes to `/(auth)` (or the existing login route).
  3. Ask for confirmation first, using `Alert.alert` on native and `window.confirm` on web.
- **Accept when:** on the web preview, signing out lands on the login screen, and a reload stays signed out (screenshot or Playwright trace). No other file changed.

### S102: Shared Groups uses its own feature gate and a real share flow (P1)
- **Role:** builder · **Depends on:** none · **Issue:** report item 6
- **Scope:** `app/(tabs)/shared-groups.tsx`, `types/monetization.ts`, `config/monetization.ts`, `components/social/ShareButton.tsx`, tests.
- **Do:**
  1. Add a `subscriptionSharing: boolean` limit: `false` for free, `true` for pro and team.
  2. Gate the screen and `ShareButton` on it instead of `smartInsights`.
  3. Set `selectedSubscriptionId` when the user chooses a subscription to share. Today the modal can never open, because nothing sets it.
  4. Remove the non-null assertion on `getSubscriptionById(...)!`. If the subscription is not found, close the modal.
- **Accept when:**
  - A test asserts free = no access and pro = access through `canAccessFeature('subscriptionSharing')`.
  - A test, or a screenshot on the preview, shows the share modal opening for a chosen subscription.
  - `smartInsights` is no longer referenced by sharing code.

### S103: Virtual Cards screen shows no invented card data (P0)
- **Role:** builder · **Depends on:** none · **Issue:** report item 7 (UI part)
- **Scope:** `app/(tabs)/virtual-cards.tsx`, components it renders under `components/embeddedFinance/` (only those), `config/featureFlags.ts`, `hooks/useFeatureFlags.ts`, tests.
- **Do:**
  1. Delete `loadMockData` and every hardcoded card number, expiry and CVV (including the CVV `'123'`).
  2. Replace "reveal details" with a disabled control and the text "Card details are shown securely in a later update".
  3. Delete the fake `Alert.alert('Copied')`.
  4. Show the user's cards from `services/virtualCards.ts` (last4, brand, status only), or an empty state.
  5. Transactions show an empty state until S304, not `return []` presented as data.
  6. Put the whole screen behind `virtualCardsEnabled`, default `false`. With the flag off, show a "Coming soon" screen.
- **Accept when:**
  - `grep -nE "'123'|4242 ?4242|loadMockData|Copied" app/\(tabs\)/virtual-cards.tsx` returns nothing.
  - A test shows the flag-off screen renders no card fields.
  - A test shows the flag-on screen renders only last4 and status from a mocked service.

### S104: Finish C07, the embedded credit flag (P2)
- **Role:** builder · **Depends on:** none · **Issue:** #39
- **Scope:** exactly the files changed on `origin/agent/c07-embedded-credit-flag` (`services/embeddedCredit.ts`, `services/communityStats.ts`, `components/embeddedFinance/EmbeddedCreditView.tsx`, tests).
- **Do:** create your branch from `main`, then merge `origin/agent/c07-embedded-credit-flag` into it. Resolve conflicts in favour of `main`'s auth code. Run the checks and fix what fails within Scope. Do not add features.
- **Accept when:** C07's **Done when** in `CARDS.md` is met, the tests prove no simulated approval renders with the flag off, and the consent check in `contributeToCommunityStats` is tested.

**Sprint 1 exit:** the orchestrator has merged all four, and the web preview shows Settings, Shared Groups and Virtual Cards with no fake data (Q02 screenshots).

---

## Sprint 2: payments on Vercel (sequential: one server PR at a time)

Read `VERCEL_MIGRATION.md` sections 1–4 first. All new server code goes in `server/` (logic) and `api/` (thin Vercel handlers). Never add files under `netlify/functions/`.

### S201: `server/` module + Vercel checkout and webhook (= M02 + C02) (P0)
- **Role:** builder · **Depends on:** D1, A2, A3 · **Issue:** #28
- **Scope:** new `server/auth.ts`, `server/cors.ts`, `server/stripe.ts`, `server/supabase-admin.ts`, `api/create-checkout-session.ts`, `api/stripe/webhook.ts`, `vercel.json`, `.vercelignore`, `.eslintrc.json` (the `no-restricted-imports` rule only), `hooks/usePayments.ts`, `netlify/functions/create-checkout-session.ts` + `stripe-webhook.ts` (reduce them to thin adapters over `server/`), tests.
- **Do:**
  1. Port `netlify/functions/_shared/auth.ts` and `_shared/cors.ts` logic into `server/` without changing behaviour (same 401/503 rules, same allowlist).
  2. Checkout:
     - take the user id and email from the verified session only;
     - resolve the price with `stripe.prices.list({ lookup_keys: ['subtrack_pro_monthly'] })`;
     - success and cancel URLs must be on the allowed origins;
     - `hooks/usePayments.ts` sends `Authorization: Bearer <access_token>`.
  3. Webhook:
     - read the raw body with `await request.text()` and verify the signature;
     - return 200 and skip (log the reason) any event whose price `metadata.project !== 'subtrack'`;
     - handle `checkout.session.completed` idempotently, keyed on the event id;
     - under D1 = (a), write no subscription state; Issuing events only;
     - under D1 = (b), write `profiles.subscription_tier` through the service role.
  4. In `vercel.json`:
     - delete the `/api/create-checkout-session` rewrite to Netlify;
     - change the SPA catch-all to `/((?!api/|_expo|static|favicon.ico|manifest.json|service-worker.js).*)`;
     - keep the headers.
  5. ESLint: forbid importing `server/` or `services/database` from `app/`, `components/`, `hooks/`.
- **Accept when:**
  - Unit tests cover:
    - bad signature → 400;
    - a foreign-project price → 200 with no DB call;
    - a SubTrack price → handled per D1;
    - a body `userId` or `email` that differs from the session is ignored;
    - success/cancel URLs off-allowlist → 400;
    - no token → 401.
  - On the Vercel preview, `curl -s -o /dev/null -w '%{http_code}' -X POST <preview>/api/stripe/webhook` returns 400 (not 200 with HTML).
  - `curl <preview>/api/nope` returns 404.
  - `grep -rn "Access-Control-Allow-Origin.*\*" api server netlify` returns nothing.

### S202: One Free→Pro upgrade flow (= C06) (P1)
- **Role:** builder · **Depends on:** S201, D2 · **Issue:** #34
- **Scope:** `hooks/usePayments.ts`, `services/stripe.ts`, `hooks/useSubscription.tsx`, `components/monetization/*`, `app/(tabs)/upgrade.tsx`, `app/billing/*`, tests.
- **Do:**
  1. Use one checkout call (`/api/create-checkout-session`), and delete the dead `/api/stripe/create-checkout-session` call.
  2. Read the tier from the D1 source only.
  3. Make `canAccessFeature` deny by default when the tier is unknown or loading.
  4. Refresh the tier on return to `app/billing/success`.
  5. `UpgradeRibbon` and `FeatureGate` keep their `router.push('/(tabs)/upgrade')` fallback. Add an `onUpgrade` prop only if a caller needs it.
- **Accept when:**
  - A Stripe **test-mode** walkthrough on the preview (free → checkout with a test card → webhook → Pro features unlock) is in the PR with screenshots. Use test keys only.
  - Tests cover deny-by-default and the refresh after success.

### S203: Port cards, banking, HIBP, Splitwise to Vercel (= M03) (P1)
- **Role:** builder · **Depends on:** S201, A5 · **Issue:** #35
- **Scope:** `server/virtual-cards.ts`, `server/banking.ts`, `server/hibp.ts`, `server/splitwise.ts`, `api/embedded-finance/virtual-cards/[...path].ts`, `api/banking/proxy.ts`, `api/hibp-check.ts`, `api/splitwise.ts`, `services/virtualCards.ts`, `services/mcpBankingService.ts`, `services/sharedSubscriptions.ts`, `services/splitwise.ts`, `config/compliance.ts`, the Netlify card and banking functions (thin adapters only), delete `netlify/functions/hibp-check.ts` + `splitwise-api.ts`, tests.
- **Do:**
  1. Move the virtual-cards logic, including the Sprint 0 validation and allowlist, into `server/virtual-cards.ts` unchanged, then follow the route map in migration plan section 3.
  2. Change the native banking path from `/banking-proxy` to `/banking/proxy`.
  3. Web uses relative `/api/...`; native bases end in `/api`.
- **Accept when:**
  - The existing `netlify/functions/__tests__/embedded-finance-virtual-cards.test.ts` cases all pass against the `api/` handler; move or duplicate them, but don't weaken any.
  - A test or preview check shows every route-map URL reaches its handler and an unknown `/api/*` returns 404.
  - A grep for `SPLITWISE_API_KEY|HAVEIBEENPWNED_API_KEY` in `app/ components/ hooks/ services/ config/` returns nothing.

**Sprint 2 exit:** the orchestrator has merged S201–S203. Netlify functions are thin adapters. The owner then runs S402.

---

## Sprint 3: real data in every screen

Runs **in parallel with Sprint 2**, except where `Depends on` says otherwise.

### S301: Real subscriptions and dashboard (= C05) (P1)
- **Role:** builder · **Depends on:** none · **Issue:** #33
- **Scope:** `hooks/useSubscriptions.ts`, `app/(tabs)/index.tsx`, `app/(tabs)/subscriptions.tsx`, new `utils/subscriptionMath.ts`, `data/mockData.ts` (demo only), tests.
- **Do:**
  1. Load the signed-in user's `sm_subscriptions` rows through the existing Supabase client; RLS scopes them to the user.
  2. Put all money and date math in `utils/subscriptionMath.ts`: monthly and annual totals with yearly/weekly normalisation, renewals in the next 7 days, a per-category breakdown.
  3. Add loading, empty and error states.
  4. Mock data only in explicit demo mode.
- **Accept when:**
  - A new user sees the empty state.
  - Unit tests cover the totals math: a yearly plan /12, a weekly plan ×52/12, mixed currencies flagged rather than summed.
  - No literal currency amounts remain in `index.tsx`.

### S302: Settings show the real user, every row works, preferences persist (P2)
- **Role:** builder · **Depends on:** S101 (same file) · **Issue:** report item 5
- **Scope:** `app/(tabs)/settings.tsx`, `app/(tabs)/reminder-settings.tsx`, new `hooks/usePreferences.ts`, tests.
- **Do:**
  1. Replace `user-123` / `user@example.com` with the session user (name from `user_metadata`, email from the session).
  2. Wire each of the 5 no-op `onPress` handlers to a real screen or action, or remove the row. List each row and its outcome in the PR.
  3. Persist preferences (theme, currency, notification toggles) with AsyncStorage through `usePreferences`. No new DB columns.
  4. "Export data" writes the user's own subscriptions to JSON (web: download; native: `Share`).
- **Accept when:**
  - `grep -nE "user-123|user@example.com|onPress=\{\(\) => \{\}\}" app/\(tabs\)/settings.tsx` returns nothing.
  - A test shows preferences survive a remount.
  - The PR has a table of the rows and their outcomes.

### S303: Analytics built on real data (P2)
- **Role:** builder · **Depends on:** S301 (reuses `utils/subscriptionMath.ts`) · **Issue:** report item 4
- **Scope:** `app/(tabs)/analytics.tsx`, components it renders, tests.
- **Do:**
  1. Replace `$247.89`, `$2,974`, "save $23" and every other literal with values computed from the user's subscriptions.
  2. "Potential savings" is only shown when a computable rule supports it: duplicates in a category, or an annual plan cheaper than the monthly one. Otherwise hide the card.
  3. Empty state for no data.
- **Accept when:**
  - `grep -nE '\$[0-9]' app/\(tabs\)/analytics.tsx` returns nothing.
  - Tests cover the savings rules with fixtures.

### S304: Real virtual-card management (P1)
- **Role:** builder · **Depends on:** S203, S103, D3 · **Issue:** report item 7 (backend part)
- **Scope:** `server/virtual-cards.ts`, `api/embedded-finance/virtual-cards/[...path].ts`, `services/virtualCards.ts`, `app/(tabs)/virtual-cards.tsx`, `package.json` + `package-lock.json` (add `expo-clipboard`, `expo-local-authentication` via `npx expo install` only), tests, and a route-map row in `VERCEL_MIGRATION.md`.
- **Do:**
  1. Add `POST /api/embedded-finance/virtual-cards/:id/ephemeral-key`. It checks ownership, then creates a Stripe ephemeral key for that card only (`nonce` from the client, `stripe-version` header).
  2. **Web:** reveal the number and CVC only through Stripe Issuing Elements, so the card number never passes through our server or app state.
  3. **Native:** show last4 only, with "View full details on the web".
  4. Before a reveal on web, re-check the session; on native, gate actions with `expo-local-authentication`.
  5. Copy uses `expo-clipboard` and copies last4 only.
  6. Transactions come from `card_authorizations` for the user's own cards.
  7. Keep the flag `virtualCardsEnabled` (S103); turning it on is an owner decision.
- **Accept when:**
  - Tests: ephemeral key for another user's card → 403; a key for one's own card is created with the card id only; the response contains no card number or CVC.
  - `grep -rnE "number|cvc" services/virtualCards.ts` shows no full number or CVC stored or logged.
  - A Stripe **test-mode** web screenshot of the Elements reveal.

**Sprint 3 exit:** no screen renders hard-coded amounts, users or cards outside demo mode (Q02 screenshots per tab).

---

## Sprint 4: cutover, database, retirement

### S401: Live-DB permission fixes as SQL (= C09) (P1)
- **Role:** builder writes the file; the **owner** applies it · **Depends on:** S202 · **Issue:** #31
- **Scope:** `supabase/proposed/2026-11-sm-permissions.sql`, `supabase/proposed/README.md`.
- **Do:** as in C09 in `CARDS.md`. Also confirm, citing the S201/S203 code, that every write to `sm_subscriptions` and `virtual_cards` uses the service role, so owner-only `SELECT` policies don't break anything. **Do not run it.**
- **Accept when:** the SQL plus a rollback block are in the PR, and the card is blocked with "needs owner: apply".

### S402: Stripe webhook cutover (= M04) (P1)
- **Role:** owner, with the orchestrator assisting via the Stripe connector · **Depends on:** S201, S202 merged and the preview test-mode run passed
- **Do:** follow migration plan section 4, steps 1–5 (tag the endpoint, change the URL, send a test event, confirm 200 in the Vercel logs). Rollback is in step 5.
- **Accept when:** a test event returns 200 on Vercel, and 24 hours of deliveries show no failures in the Stripe dashboard.

### S403: End-to-end smoke and layout check (= Q01 + Q02) (P1)
- **Role:** qa · **Depends on:** S202, S301 (repeat after S304)
- **Do:**
  1. On the Vercel preview, run Playwright: sign up → add a subscription → dashboard totals → upgrade with a test card → Pro unlocks → sign out.
  2. Take a screenshot of every tab at 390×844 and 1280×800.
  3. File one issue per defect.
- **Accept when:** the trace or screenshots are attached to the card, and every defect has an issue number.

### S404: Retire Netlify (= M05) (P2)
- **Role:** builder + owner · **Depends on:** S203, S402, and 7 days of clean deliveries
- **Do / Accept when:** exactly as M05 in `CARDS.md` and migration plan section 5. Legacy paths stay served (no 301).

---

## 4. Dependency graph

```
Sprint 1 (parallel): S101  S102  S103  S104
Sprint 2 (serial):   D1,A2,A3 → S201 → S202 (needs D2)
                                    └→ S203 (needs A5)
Sprint 3:            S301 → S303
                     S101 → S302
                     S203 + S103 + D3 → S304
Sprint 4:            S202 → S401 (owner applies)
                     S201 + S202 → S402 (owner) → +7d → S404 (also needs S203)
                     S202 + S301 → S403
```

## 5. Orchestrator review gate (what gets a PR rejected)

### R00: Review each agent PR
- **Role:** reviewer (a Hermes reviewer first, then the orchestrator, who makes the final call and merges)
- **Do:** for each PR, check every **Accept when** item against its evidence, re-run the checks, and apply the rejection list below. Approve, or request changes with file and line.

Rejection list:

- Any **Accept when** item lacks evidence, or the evidence is "should work".
- Files outside Scope, new dependencies not listed in Scope, or edits to `android/`, `ios/`, `eas.json` or workflows.
- Tests weakened, skipped or deleted, or a test that mocks the very thing it claims to verify.
- Mock or demo data reachable without demo mode; any hardcoded card data.
- Server code added under `netlify/functions/` (except the thin adapters S201/S203 allow).
- Secrets, emails, tokens or local paths anywhere in the diff, PR or card comments.
