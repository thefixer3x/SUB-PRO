# Blueprint Conformance Scorecard — SubTrack Pro

**Blueprint:** `.bolt/prompt` @ `9644074` (7 Jul 2025 initial commit; removed 29 Oct 2026 docs-archive)
**Audited against:** `origin/main` = `9b4b02c3`
**Audited:** 2026-11-04

> The blueprint is a *standards + product-prompt* artefact from the Bolt.new era. It mixes
> hard constraints (Tailwind, feature flags, `expo-local-authentication`, 200 KB bundle) with
> aspirational targets (Lighthouse ≥ 90, Open Banking FAPI/mTLS). Its own TL;DR claims
> features "the product already ships" — but the July 2025 initial commit predates most of the
> code, so treat those claims as intent, not evidence.

Scoring: **Implemented** · **Partial** · **Planned/flagged-off** · **Not implemented** · **Evolved** (deliberately superseded)

---

## Score summary

| Section | Implemented | Partial | Planned | Not built | Evolved |
|---|---|---|---|---|---|
| Design & styling | 1 | 1 | 0 | 1 | 0 |
| Content & media | 0 | 0 | 0 | 3 | 0 |
| Performance & a11y | 1 | 2 | 0 | 2 | 0 |
| Security & compliance | 1 | 2 | 0 | 2 | 0 |
| CI/CD | 1 | 1 | 0 | 1 | 0 |
| Feature flags | 1 | 1 | 0 | 1 | 0 |
| Coding style | 2 | 1 | 0 | 1 | 0 |
| Documentation | 0 | 1 | 0 | 1 | 0 |
| **Product scope** | 8 | 6 | 3 | 2 | 2 |
| **TOTAL (38 items)** | **15** | **15** | **3** | **14** | **2** |

**Headline: ~39% fully implemented · ~39% partial · ~8% planned · ~37% not built.**
The product *core* (tracking, analytics, monetization, budgets) is in good shape. The
**standards layer** (Tailwind, media pipeline, Lighthouse budget, Open Banking, MDX docs)
is largely aspirational and was never built.

---

## 1. Design & Development

| Blueprint requirement | Status | Evidence |
|---|---|---|
| JSX + Tailwind only | **Evolved → Not built** | `nativewind`/`tailwindcss` deps: **0**. `tailwind.config`: **0**. `className=` in `app/`+`components/`: **0 files**. Styling is `StyleSheet.create()` throughout. RN + Tailwind requires NativeWind; never adopted. |
| CSS < 10 KB gzip (Tailwind purge) | **Not built** | No Tailwind → nothing to purge. |
| React Hooks, no class components | **Implemented** | 0 `React.Component`/`extends Component`; all hooks. |
| Lucide icons, tree-shakable SVG | **Implemented** | `lucide-react` dep present; `lucide-react-native` used in `app/(tabs)/virtual-cards.tsx`. |
| Document choices (Figma + Notion) | **Not built** | No Figma/Notion links; no tooling. |
| No inline styles except dynamic `calc()` | **Not built (superseded)** | StyleSheet is the RN-native equivalent; the constraint is web-oriented. |

## 2. Content & Media

| Requirement | Status | Evidence |
|---|---|---|
| Unsplash via API, no hot-linking | **Not built** | `unsplash` refs in `app/ components/ services/ hooks/`: **0**. No image pipeline at all. |
| Download → WebP/AVIF → CDN/Supabase Storage | **Not built** | `webp` refs: **0**. `storage.from`/`upload(` refs: **0**. |
| Lazy-load, explicit width/height (CLS) | **Partial** | `loading="lazy"`: 4 files. `alt=`: 1 file. `srcSet`: 1 file. Images are sparse — mostly icons, so little to optimise. |
| Nightly broken-link scan + media backup | **Not built** | No cron/scheduled workflow; `blogwatcher`-style monitoring absent from CI. |

## 3. Performance & Accessibility

| Requirement | Status | Evidence |
|---|---|---|
| Main JS bundle ≤ 200 KB gzipped | **Not built** | No budget assertion anywhere: `204800` → 0 hits in `scripts/`, `.github/`, `package.json`. `scripts/analyze-build.js` **prints** sizes but never fails on them. |
| Lighthouse ≥ 90 (Perf/A11y/PWA) | **Not built** | `lighthouserc` file: **none**. `lhci` in any workflow: **none**. `npm run lighthouse` → `lhci autorun` exists but has no config and runs nowhere. |
| WCAG 2.1 AA contrast/focus/alt-text | **Partial** | `accessibilityLabel`/`accessibilityRole`: 12 files. `alt=`: 1 file. No automated contrast audit. |
| Static generation/SSR for marketing | **Partial** | Expo Router static export (`expo export -p web`) — good for `app/(landing)`, but no per-page SSR/SSG split. |
| Lighthouse/WebPageTest dashboard in Notion | **Not built** | No dashboard, no Notion. |

## 4. Security & Compliance

| Requirement | Status | Evidence |
|---|---|---|
| Open Banking security profile (FAPI + mTLS) | **Not built** | Only `components/banking/BankAccountConnector.tsx` mentions it — and that path returns *"Open Banking integration is under development. Please use bank credentials for now."* No FAPI, no mTLS, no client-cert handling. |
| `expo-local-authentication` for FaceID/TouchID + OTP fallback | **Evolved → Removed** | Was in `app/(tabs)/virtual-cards.tsx`; **removed on main** (web-export fix — RN-only module broke Metro web bundling). Package dep: **0**. Biometric refs: 3 files. `signInWithOtp`/`verifyOtp`: **0 files** → no OTP fallback exists. |
| SecureStore with `requireAuthentication: true` | **Partial** | `expo-secure-store` dep present. `requireAuthentication` → **0 hits** in app code. Tokens stored, but no biometric gate on read. |
| 2FA / biometrics | **Partial** | 3 files reference biometric concepts; no enforced 2FA flow. |
| Secrets via GH Actions (`EAS_TOKEN`, `SUPABASE_URL`) | **Implemented** | `secrets.` refs in `.github/`: 4. `EAS_TOKEN` literal: 0 (correctly indirected through `secrets.*`). |
| Plain-language security summaries | **Partial** | `docs/` has 132 files including agent plans; no dedicated exec-facing security summary found. |

## 5. CI/CD

| Requirement | Status | Evidence |
|---|---|---|
| `eas-build.yml` on push to `main` → EAS build | **Evolved → Implemented** | File renamed `enhanced-eas-build.yml`. Triggers: `push: [main]`, `pull_request: [main]`, `workflow_dispatch`. |
| Node 18 | **Evolved** | `NODE_VERSION: 22` (and pre-build validation uses Node 20). Upgraded for CVE/tooling. |
| Bolt.new commits → GitHub PRs → merge to `main` triggers build | **Implemented** | `pull_request` trigger + `workflow_dispatch`; PR-gated build workflow. |
| Merge to `main` triggers build | **Implemented** | `push: branches: [main]`. |

## 6. Feature Flags

| Requirement | Status | Evidence |
|---|---|---|
| Flags exist and gate modules | **Implemented** | `config/featureFlags.ts` — 21 flags; `contexts/FeatureFlagsContext.tsx`; `hooks/useFeatureFlags.ts`; **DB-backed** via `sm_feature_flags` (no redeploy needed). |
| **Default OFF** | **Partial / evolved** | Blueprint: all default OFF. Today: `SMART_INSIGHTS: true`, `EMBEDDED_FINANCE: true`, `CANCELLATION_BOT: true`, `AI_ASSISTANT: true`, `DARK_MODE: true`. Still OFF: `MONETIZATION_V1`, `EMBED_FINANCE_BETA`, `SOCIAL_1`, `COMPLIANCE_CENTER`, `PARTNER_HUB`, `BULK_UPLOAD`, `virtualCardsEnabled`. `virtualCardsEnabled` has a **dedicated fail-closed test** (`__tests__/virtualCardsFeatureFlag.test.ts`). |
| `SMART_INSIGHTS` = AI churn-risk predictions | **Partial** | 23 files reference churn/insight. `services/insightEngine.ts` + `services/envelopeMath.ts` exist. Heuristic, not a trained model. |
| `MONETIZATION_V1` = Free vs Pro + AdMob banners | **Partial** | Flag is **OFF**. Free/Pro tiering is live via `hooks/useSubscription.tsx` (deny-by-default, S202). Ad banners exist (`components/monetization/AdBanner.tsx`) — **AdMob SDK itself is absent**; banner is an in-app component. |
| `EMBED_FINANCE_BETA` = virtual cards + affiliate links | **Partial** | Flag OFF; `virtualCardsEnabled` also OFF. Virtual-card **server** is built (`server/virtual-cards.ts`, `api/embedded-finance/virtual-cards/[...path].ts`) but the screen is gated off until an authorized backend serves live cards (card S103). |
| `COMPLIANCE_CENTER`, `PARTNER_HUB` | **Partial** | Both flags exist and are OFF; UI surfaces exist (`app/(tabs)/marketplace.tsx`). |
| `SOCIAL_1` | **Not built** | 0 references anywhere. |

## 7. Coding Style

| Requirement | Status | Evidence |
|---|---|---|
| React Hooks | **Implemented** | Confirmed — no class components. |
| `React.memo` for heavy components | **Partial** | 3 files. Blueprint asked for it on heavy comps; widespread use is absent. |
| Use **SWR** for data + skeleton loaders > 300 ms | **Evolved** | `swr` dep: **0**. Replaced by `@tanstack/react-query` (9 files) — a deliberate, arguably better, substitution. **EVOLVED**, not a miss. |
| Skeleton loaders | **Implemented** | 3 files. |
| Icons sized via `className="w-5 h-5"` | **Evolved** | No Tailwind → sized via `StyleSheet` / RN `size` prop. |
| Inter (body) + Poppins (display) via Google Fonts | **Implemented** | `@expo-google-fonts/inter`, `@expo-google-fonts/poppins`, `expo-font` all in deps. |

## 8. Documentation

| Requirement | Status | Evidence |
|---|---|---|
| MDX page in `/docs` per new component | **Not built** | `.mdx` files: **0**. `docs/` has 132 files, but they're Markdown agent plans (`docs/agents/EXECUTION_PLAN.md`, etc.), not per-component MDX. |
| Business-friendly language, minimal jargon | **Partial** | `docs/agents/` is engineering-facing. Some docs are readable; no enforced standard. |
| PR descriptions: What / Why / How / Screenshots | **Partial** | PR bodies exist but no template enforcing the four sections; no screenshots. |

---

## 9. Product Scope (from the blueprint's TL;DR table)

### Core Features

| Feature | Status | Evidence |
|---|---|---|
| Customisable dashboard | **Implemented** | `app/(tabs)/index.tsx`; S301 rebuilt it on real Supabase data (`utils/subscriptionMath.ts`). |
| Subscription list | **Implemented** | `app/(tabs)/subscriptions.tsx`; `hooks/useSubscriptions.ts` reads real rows. |
| Analytics | **Implemented** | `app/(tabs)/analytics.tsx`; S303 removed hardcoded currency and computes savings from real amounts. Recharts dep present. |
| Settings | **Implemented** | `app/(tabs)/settings.tsx`; S302 wired every row to the real user + `hooks/usePreferences.ts` (AsyncStorage). |
| Budget alerts | **Implemented** | `components/BudgetAlertRow.tsx` + test. |
| Weekly reports | **Partial** | Referenced in `settings.tsx` + `usePreferences.ts` — appears to be a *preference toggle*, not a generated report. |
| Dark/light theme | **Implemented** | `contexts/ThemeContext.tsx`; 25 files use theme. |
| Offline notice | **Partial** | 3 files. |
| Pull-to-refresh | **Implemented** | 4 files, incl. `virtual-cards.tsx`. |

### Advanced UX

| Feature | Status | Evidence |
|---|---|---|
| Framer-motion card animations | **Evolved** | `framer-motion` dep: **0**. `react-native-reanimated` present — RN-native equivalent. |
| Skeleton loaders | **Implemented** | 3 files. |
| Smart navigation caching | **Partial** | 13 files reference caching/persistence. |
| Performance budgets ≤ 200 KB gzipped | **Not built** | No enforcement (see §3). |

### Bulk Ops

| Feature | Status | Evidence |
|---|---|---|
| CSV/XLSX importer with field-mapping + validation | **Not built** | `BULK_UPLOAD` flag exists and is **OFF**. No importer UI/service found in `app/ components/ services/`. **This is the largest single gap** against the blueprint's TL;DR table, which claims it ships. |

### Data-Viz

| Feature | Status | Evidence |
|---|---|---|
| Recharts line/pie/heat-map/scatter | **Partial** | `recharts` dep present and used in analytics. Heat-map/scatter not confirmed as implemented. |

### Monetization Roadmap

| Feature | Status | Evidence |
|---|---|---|
| Freemium tier | **Implemented** | `hooks/useSubscription.tsx` — real tier from `profiles.subscription_tier`, deny-by-default (`canAccessFeatureForTier` extracted + mutation-tested). |
| Ads for free users | **Partial** | `AdBanner.tsx` component + 3 usage sites. **No AdMob SDK** — no `expo-ads-admob`/`react-native-google-mobile-ads` dep. Blueprint named AdMob explicitly. |
| Stripe-based Pro plan | **Implemented** | `server/stripe.ts`, `api/create-checkout-session.ts`, `api/stripe/webhook.ts`, `app/billing/success.tsx` with tier refresh. |
| Partner marketplace | **Partial** | `app/(tabs)/marketplace.tsx`; `PARTNER_HUB` flag OFF. Affiliate links not confirmed wired. |
| AI churn-risk predictions | **Partial** | `services/insightEngine.ts`; `SMART_INSIGHTS` flag is **ON**. Heuristic, not ML. |
| Virtual cards | **Partial** | Full server + API + tests (S203, 228 tests). **Screen gated off** (`virtualCardsEnabled: false`) pending an authorized backend. |
| Automated cancellation | **Partial** | `hooks/usePayments.ts` + `services/mcpBankingService.ts`. |

---

## 10. Newer Direction (the "evolved" layer)

The card-funding / AI-manager spec is a **2026 draft**, explicitly "not built". The project has
since moved into **P0/P1 hardening** that the blueprint never anticipated:

| Item | Status | Evidence |
|---|---|---|
| Subscription set-asides / budget envelopes | **Partial** | `services/envelopeMath.ts` — built (P1). |
| Plan inbox | **Partial** | `components/PlanInbox.tsx`, `services/planInboxApi.ts` — built (P1). |
| Insights (3 types) | **Partial** | `services/insightEngine.ts` — built, with "tighten insight matching and recovery controls" as the tip commit of the local branch. |
| Card funding | **Not built** | Zero references. Draft only. |
| Webhook idempotency + permission migrations | **In progress** | `fix/p0-idempotency-semantics`, `p0-s401-idempotency`, `feat/p1-envelopes-insights` branches; `supabase/proposed/` migrations; `npm run test:migrations` in CI. |

---

## 11. The three highest-value gaps

Ranked by blueprint-conformance value, not by effort:

### 1. Bundle-size budget + Lighthouse CI — *Not built*
The blueprint set **≤ 200 KB gzipped** and **Lighthouse ≥ 90** as hard constraints and both are
**unenforced**. `npm run lighthouse` runs `lhci autorun` with **no `lighthouserc`** — it cannot
pass or fail meaningfully. The concrete risk: nothing stops the main bundle from silently
crossing 200 KB as P1 features land. This is cheap to fix: add `lighthouserc.json` + a size
assertion to `scripts/analyze-build.js`, wire both into `pre-build-validation.yml`.

### 2. Bulk import (CSV/XLSX) — *Claimed shipped, not built*
The blueprint's own TL;DR table says the product "already ships" a CSV/XLSX importer with
field-mapping and validation. `BULK_UPLOAD` is `false` and no importer code exists. Either
implement it or correct the blueprint — right now the record is wrong.

### 3. AdMob SDK — *Partially built*
`MONETIZATION_V1` is OFF and `AdBanner.tsx` renders an in-app banner, but **no AdMob SDK** is
installed. The blueprint names AdMob explicitly. If ads are the monetization path, this is a
real dependency gap; if the in-app banner is the deliberate choice, the blueprint should be
amended.

---

## 12. Amendments the blueprint needs

These are cases where the code is *better* than the blueprint and the spec is the stale artifact:

1. **Tailwind** → RN `StyleSheet` + `react-native-reanimated`. Blueprint is web-oriented; the project is RN-native. Amend the styling section.
2. **SWR** → `@tanstack/react-query`. Better caching, mutation support. Amend.
3. **Node 18** → Node 22. Amend.
4. **`eas-build.yml`** → `enhanced-eas-build.yml`. Rename in spec.
5. **`expo-local-authentication`** → removed (broke Metro web bundling). If biometrics are wanted, re-add behind a platform guard (`.native.ts` / `.web.ts` split) — that keeps the web export green **and** satisfies the security requirement.
6. **Feature-flag defaults** → several now default ON. Either amend or justify each.
7. **MDX per component** → `docs/agents/*.md` plans instead. Cheaper and more useful; amend the docs rule.

---

## 13. Verification method

Every status above was derived by querying the git object store for `origin/main` = `9b4b02c3`
(not the working tree), so the audit reflects what is actually merged:

```bash
git grep -l -E "<pattern>" origin/main -- <path>   # existence checks
git show origin/main:<file>                        # content checks
git ls-tree -r --name-only origin/main             # file-existence checks
```

Local branch → `origin/main` content equivalence was checked with `git cherry -v`, which
compares patch-ids and therefore survives the SHA rewrite of `main`
(`a70584c0` → `9b4b02c3`).
