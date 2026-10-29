# Configuration Audit Analysis - SUB-PRO 

**Repository:** `github.com/thefixer3x/SUB-PRO` (submodule of `seftechub-workspace`)
**Commit:** `d10dd3b` on `main`
**Date:** 2026-10-29
**Auditor:** Read-only code/configuration analysis. No production systems tested. No weaponized payloads.
**Stack:** Expo/React Native web (static export via `expo export -p web`), Netlify + Vercel deployment, Supabase (PostgreSQL), Stripe (Connect + Issuing + Billing), Netlify Functions, GitHub Actions CI.

---

## 1. Scope & Assumptions

| Dimension | Value |
|---|---|
| Target | `apps/SUB-PRO` in `seftechub-workspace` monorepo |
| Code under review | 27 Expo Router `+api.ts` routes, 4 Netlify Functions, 8 Supabase migrations, CI workflows, web build config |
| PRD used | `attached_assets/PRD.pdf` — **TestSprite PRD** (AI end-to-end testing platform); does NOT describe SUB-PRO. Used only as a test-plan framework for SUB-PRO QA, not as the system under audit. |
| Deployment reality | `npx expo export -p web --output-dir dist` produces a static SPA. `@netlify/plugin-expo` is NOT installed, so 23 of 27 `app/api/**` routes are **NOT deployed as Netlify functions** — they are pre-deploy artifacts. Only 4 Netlify functions are wired: `banking-proxy`, `create-checkout-session`, `embedded-finance-virtual-cards`, `stripe-webhook`. Vercel rewrites proxy only `/api/create-checkout-session` to the Netlify endpoint. **Findings below distinguish LIVE (deployed) from LATENT (pre-deploy).** |
| Authorization | Assumed auditor is the repository owner. Safe-only analysis. |
---

## 2. Executive Summary

This audit identified **28 distinct findings** across critical, high, medium, and low severity tiers. The most urgent issue is a **committed EAS build token exposed in plain text across 11 commits** (CVSS 9.8). The second most critical finding is **4 live Netlify functions with zero authentication**, allowing unauthenticated actors to create Stripe virtual cards, list all cards in the Stripe Issuing account, manipulate spending controls, and initiate subscription checkouts. Additionally, **23 Expo Router API routes are unauthenticated IDOR/injection vectors** that, while currently unreachable at production scale due to the static export without `@netlify/plugin-expo`, would be immediately exploitable if deployed to a Next.js-compatible host or if the Netlify Expo plugin is later installed. Systemic issues include no HTTP security headers, no OWASP Top 10 scanning, no dependency pinning in CI, overly permissive Supabase RLS policies, plaintext web token storage, and dead broken Python core files with AppleScript injection risks.

**Immediate action required:** Rotate `EAS_ROBOT_TOKEN`, purge it from git history, remove `build-result.json` from tracking, and add auth to the 4 deployed Netlify functions.

---

## 3. Methodology

- **OWASP ASVS v4.0.3** — Authentication, Authorization, Session Management, Input Validation, Error Handling, Cryptography
- **OWASP Top 10 2021** — Broken Access Control, Cryptographic Failures, Injection, Security Misconfiguration
- **STRIDE Threat Modeling** — Spoofing, Tampering, Repudiation, Information Disclosure, Elevation of Privilege, Denial of Service
- **CIS Benchmarks** — Netlify/CI configuration hardening
- **CVSS v3.1** — Each finding rated with base score and full vector string

---

## 4. STRIDE Threat Model

### Trust Boundaries
| Boundary | Data Flow | Threat |
|---|---|---|
| Internet → Netlify/Vercel → Static SPA | Client renders UI, calls Netlify Functions | Spoofing (no mTLS), Tampering (no CSP/HSTS) |
| Netlify Functions → Stripe API | Functions call Stripe Issuing/Billing via secret key | Elevation of Privilege (unauth function calls), IDOR |
| SPA → Supabase (anon key) | Client queries RLS-protected tables | IDOR if RLS bypassed via `SECURITY DEFINER` misconfig |
| `services/database.ts` → Supabase (service role key) | Server routes use full DB access | RLS bypass (key only used in webhook handler) |
| GitHub Actions → Code + Stripe API keys | CI runs Claude Code agent with `ANTHROPIC_API_KEY` | Prompt injection via PR comments, floating action tags |
### Data Classification
- **Confidential:** Stripe secret key, Supabase service role key, EAS robot token, Apple App Store Connect credentials
- **Internal:** Supabase anon key, Sentry DSN, feature flag configs
- **Public:** Stripe publishable key, public API routes (none secured)

---

## 5. Findings — Prioritized by CVSS v3.1

---

### F01 — CRITICAL: Committed EAS Robot Token in Git History

- **CVSS v3.1:** 9.8 `AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H`
- **Severity:** Critical
- **Affected:** `docs/integration/GITHUB-SECRETS-SETUP.md:14`
- **Description:** An EAS (Expo Application Services) robot access token (`EAS_ROBOT_TOKEN`) is stored in plain text in a git-tracked file at HEAD. The token appears in **11 commits** spanning from initial setup through multiple "security: remove exposed token" attempts — meaning the token was **never actually removed** from history, only commented/removed in the working tree.
- **Evidence:**
  - `docs/integration/GITHUB-SECRETS-SETUP.md:14` — `EAS_ROBOT_TOKEN = <token>` at HEAD
  - `git log -S <token> --all` — 11 commits
  - `build-result.json` (also committed) contains the token and a commit message saying it "needs to be revoked"
  - Token also present in `docs/architecture/PROJECT_MILESTONE_SUMMARY.md` and `docs/archive/CLAUDE.md`
- **Impact:** An actor with this token can authenticate to EAS as the project's build robot — triggering builds, managing profiles/certs, and potentially injecting malicious code into build pipelines. The Apple App Store Connect identity and API key in `eas.json` compound this to full App Store deployment capability.
- **Safe Reproduction:** _Reproduction removed from the public copy until fixed._
- **Remediation:**
  1. **Immediately rotate** the EAS token in Expo Dashboard → Settings → API Tokens. This action is irreversible.
  2. Rewipe git history: `git filter-branch --force --index-filter 'git rm --cached --ignore-unmatch docs/integration/GITHUB-SECRETS-SETUP.md' --prune-empty -- --all` or use `git-filter-repo`. Push force.
  3. Remove `build-result.json` from tracking: `git rm --cached build-result.json`
  4. Add token references to `.gitignore` patterns
  5. Audit EAS Dashboard → API Tokens → Revoke any tokens older than the rotation point
  6. Update GitHub Actions secrets with the new token; remove from any docs or inline configs
- **References:** CWE-798 (Use of Hardcoded Credentials), CWE-537 (Embedded Sensitive Information); NIST SP 800-53 AC-3; OWASP API1:2023 Broken Object Level Authorization

---

### F02 — CRITICAL: Unauthenticated Stripe Virtual Card Management (Live Netlify Function)

- **CVSS v3.1:** 9.1 `AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N`
- **Severity:** Critical
- **Affected:** `netlify/functions/embedded-finance-virtual-cards.ts` — routes: `/embedded-finance/virtual-cards` and `/embedded-finance/virtual-cards/*`
- **Description:** The deployed Netlify function handling virtual card CRUD has **zero authentication**. All HTTP methods (GET/POST/PUT/PATCH) accept requests from any source.
  - `handleList` (line 231): No `userId` filter returns **all** Stripe Issuing cards (up to 100 per page) including cardholder names, emails, last4, spending controls, metadata
  - `handleRetrieve` (line 302): Accepts arbitrary `cardId`, returns full card details (cardholder name/email, spending controls, metadata)
  - `handleUpdate` (line 345): Accepts arbitrary `cardId` + `status` (active/inactive/canceled) + `spending_limits` (any amount) — an attacker can freeze any card or zero out its spending limit
  - `handleCreate` (line ~73): Accepts arbitrary `userId`, `userEmail`, `userName` — creates Stripe cardholders and cards
  - `ensureCustomer` (line ~208): **Stripe search query injection** — builds query by string interpolation: `` `email:'${userEmail}' OR metadata['userId']:'${userId}'` ``
- **Impact:** Full read/write access to Stripe Issuing virtual cards. Card disclosure, status manipulation, spending control tampering, arbitrary card creation.
- **Safe Reproduction:** _Reproduction removed from the public copy until fixed._
- **Remediation:**
  1. Add bearer token verification using Supabase auth: extract `Authorization: Bearer <token>` header, call `supabase.auth.getUser(token)`, validate `userId` matches the requested resource
  2. Pin `userId` from the verified session — never trust client-supplied `userId`
  3. Implement per-card ownership checks before retrieve/update operations
  4. Block `userId`/`userEmail` in `handleCreate` — derive from session instead
  5. Replace string interpolation in `ensureCustomer` with explicit parameterized queries or Stripe's native search with exact match
```typescript
  // Example: auth middleware for Netlify function
  import { getUser } from '@/lib/supabase-auth';
  
  async function requireAuth(event: NetlifyEvent): Promise<User | null> {
    const authHeader = event.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) return null;
    return getUser(authHeader.slice('Bearer '.length).trim());
  }
```
- **References:** CWE-306 (Missing Authentication), CWE-288 (Authentication Bypass), CWE-77 (Command Injection — query string interpolation), OWASP API4:2023 Lack of Resources & Rate Limiting, OWASP API2:2023 Broken Authentication

---

### F03 — HIGH: AI Agent Prompt Injection (GitHub Actions)

- **CVSS v3.1:** 7.5 `AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:N/A:N`
- **Severity:** High
- **Affected:** `.github/workflows/claude.yml:4-45`, `.github/workflows/claude-code-review.yml:4-42`
- **Description:** Two GitHub Actions workflows run Claude Code with full repository and API key access. The `claude.yml` workflow triggers on **any** `@claude` mention in issue comments, PR review comments, and issue bodies — with **no actor allowlist**. The `claude-code-review.yml` runs Claude on **every PR**. Both use `anthropics/claude-code-action@beta` (floating tag) with `${{ secrets.ANTHROPIC_API_KEY }}`.
- **Impact:** Any external PR commenter or issue participant can execute arbitrary prompts with full repo read access and the Anthropic API key. This enables data exfiltration, prompt injection, and potential supply chain attacks via AI-generated commits.
- **Safe Reproduction:** _Reproduction removed from the public copy until fixed._
- **Remediation:**
  1. Add actor allowlist: `if: github.actor == 'trusted-user' || github.actor == 'bot-account'`
  2. Pin action versions: `anthropics/claude-code-action@v1.0.0` (not `@beta`)
  3. Restrict `claude.yml` trigger to `types: [edited]` not `created` — prevents auto-trigger on bot comments
  4. Use GitHub's `permissions` block to limit to `contents: read` (currently has `id-token: write` which is excessive)
  5. Consider `GITHUB_TOKEN` restrictions via repository settings → Actions → Workflow permissions → "Read repository contents and packages only"
- **References:** CWE-77 (Command Injection), CWE-295 (Improper Certificate Validation — floating tags), OWASP A07:2021 Identification and Authentication Failures

---

### F04 — HIGH: Missing HTTP Security Headers (Netlify)

- **CVSS v3.1:** 7.4 `AV:N/AC:L/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N` (using AC:L for single missing header set) → **7.2** `AV:N/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:N`
- **Severity:** High
- **Affected:** `netlify.toml:47-51` — only `/static/*` gets `Cache-Control`
- **Description:** The Netlify configuration only sets `Cache-Control: public, max-age=31536000, immutable` for `/static/*`. No security headers are configured for `/*` or `/api/*`:
  - No `Strict-Transport-Security` (HSTS)
  - No `Content-Security-Policy` (CSP)
  - No `X-Frame-Options` (clickjacking)
  - No `X-Content-Type-Options: nosniff`
  - No `Referrer-Policy`
  - No `Permissions-Policy` (feature policy)
- **Impact:** XSS via inline scripts, clickjacking, MIME-type sniffing attacks, referrer leakage, cross-origin framing of authentication flows.
- **Safe Reproduction:** _Reproduction removed from the public copy until fixed._
- **Remediation:** Add to `netlify.toml`:
```toml
  [[headers]]
    for = "/*"
    [headers.values]
      Strict-Transport-Security = "max-age=31536000; includeSubDomains; preload"
      X-Content-Type-Options = "nosniff"
      X-Frame-Options = "DENY"
      Referrer-Policy = "strict-origin-when-cross-origin"
      Permissions-Policy = "camera=(), microphone=(), geolocation=()"
  [[headers]]
    for = "/api/*"
    [headers.values]
      X-Content-Type-Options = "nosniff"
      X-Frame-Options = "DENY"
```
- **References:** CWE-693 (Protection Mechanism Failure); OWASP A05:2021 Security Misconfiguration; CIS Netlify Benchmark 2.1

---

### F05 — HIGH: Permissive CORS on Sensitive Netlify Functions

- **CVSS v3.1:** 7.5 `AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N`
- **Severity:** High
- **Affected:** `netlify/functions/banking-proxy.ts:18`, `netlify/functions/create-checkout-session.ts:25,37,93`, `netlify/functions/embedded-finance-virtual-cards.ts:16`
- **Description:** All three functions use `Access-Control-Allow-Origin: *` (wildcard CORS). The `create-checkout-session.ts` also returns the wildcard header on the health-check GET response (line 38-42) and on the success response (line 93).
- **Impact:** Any cross-origin request can access sensitive data — Stripe checkout sessions, banking proxy responses, virtual card data. Combined with the lack of authentication (F02), this turns the functions into open data endpoints.
- **Safe Reproduction:** _Reproduction removed from the public copy until fixed._
- **Remediation:** Replace wildcard with explicit origin:
```typescript
  'Access-Control-Allow-Origin': origin === process.env.SITE_URL ? origin : 'https://subtrack-pro.lanonasis.com'
```
  Add `Access-Control-Allow-Credentials: true` when using credentials. Validate the `Origin` header before responding.
- **References:** CWE-942 (Permissive Cross-domain Web Public Access); OWASP A01:2021 Broken Access Control

---

### F06 — CRITICAL: 23 Unauthenticated Expo Router API Routes (Latent / Pre-Deploy)

- **CVSS v3.1:** 9.1 `AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N`
- **Severity:** Critical (latent — currently unreachable at production scale due to static export without `@netlify/plugin-expo`)
- **Affected:** 23 of 27 `app/api/**` routes
- **Description:** Of the 27 Expo Router API routes, only 5 contain any auth-related code (`banking/proxy`, `connect/webhooks/authorization`, `stripe/webhook`, `virtual-cards/create`, `virtual-cards/[cardId]/update`). The remaining **23 routes have zero authentication**:

| Route | Risk |
|---|---|
| `embedded-finance/cancellation/request+api.ts` | Accepts `userCredentials {email, password}` — forwards to vendor; unauthenticated |
| `embedded-finance/affiliates/create+api.ts` | Creates affiliates with client-supplied `commission` — fee manipulation |
| `embedded-finance/virtual-cards/[cardId]/retrieve+api.ts` | No auth, no userId check — returns any card's details (cardholder name/email, spending controls) |
| `embedded-finance/virtual-cards/list+api.ts` | No auth, no userId filter — returns ALL cards |
| `feature-flags/index+api.ts` | Updates feature flags; uses `EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` |
| `marketplace/track-click+api.ts` | Accepts client-supplied `userId`, `userAgent`, `ipAddress` — analytics poisoning |
| `marketplace/partner-stats/[id]+api.ts` | No auth |
| `compliance/security/health-check+api.ts` | Accepts/log arbitrary objects — log injection |
| `compliance/gdpr/export-request+api.ts` | Arbitrary `userId` — triggers data export for any user |
| `compliance/gdpr/deletion-request+api.ts` | Arbitrary `userId` — triggers deletion, **returns `confirmationToken` in response body + logs to stdout** |
| `compliance/audit/log+api.ts` / `audit/events+api.ts` | Write-only-to-console audit log — anyone can inject/falsify audit events |
| `social/data-sharing+api.ts` / `shared-groups+api.ts` | Consent state manipulable by anyone |
| `social/most-tracked+api.ts` / `category-insights+api.ts` / `community-stats+api.ts` | Analytics poisoning |
| `connect/payments/create+api.ts` | Client controls `amount`, `application_fee_amount`, `connected_account_id` — fee manipulation/value transfer |
| `connect/accounts/[accountId]/onboarding+api.ts` | Creates Stripe Account Links for arbitrary `accountId`, client-supplied `refresh_url`/`return_url` — open redirect |
| `connect/accounts/create+api.ts` | Creates Stripe Connect Express accounts for arbitrary emails |
| `stripe/create-checkout-session+api.ts` | Client-supplied `priceId`, `customerId`, `successUrl`, `cancelUrl` — arbitrary-price checkout + open redirect |
| `stripe/create-portal-session+api.ts` | Client-supplied `customerId` — Stripe billing portal session for any customer (account takeover) |
- **Impact:** If deployed as serverless functions, these routes allow unauthenticated access to Stripe checkout creation, billing portal access, Connect account creation, payment fee manipulation, GDPR deletion triggers, audit log falsification, feature flag manipulation, and virtual card data disclosure.
- **Safe Reproduction:** _Reproduction removed from the public copy until fixed._
- **Remediation:**
  1. **Immediate:** Ensure the 23 routes are truly unreachable in production. Verify `@netlify/plugin-expo` is not installed. Verify no Vercel/Next.js deployment host is configured.
  2. **When deploying as functions:** Add auth middleware to all `app/api/**` routes. Use a shared auth utility:
```typescript
  // app/api/auth.ts
  import { getUser } from '@/lib/supabase-auth';
  
  export async function requireAuth(req: Request) {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }
    const user = await getUser(authHeader.slice('Bearer '.length).trim());
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    return { user };
  }
```
  3. Add `@netlify/plugin-expo` or equivalent to properly route API functions.
  4. Remove `EXPO_PUBLIC_` prefix from service-role key — rename to `SUPABASE_SERVICE_ROLE_KEY` to prevent client-bundle inlining (see F25).
- **References:** CWE-306 (Missing Authentication), CWE-200 (Information Exposure), CWE-770 (Allocation of Resources Without Limits), OWASP API1:2023, OWASP API5:2023

---

### F07 — HIGH: GDPR Deletion Request Exposes Confirmation Token

- **CVSS v3.1:** 8.1 `AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H`
- **Severity:** High
- **Affected:** `app/api/compliance/gdpr/deletion-request+api.ts:13,20,36,38`
- **Description:** The GDPR deletion request endpoint accepts any `userId`, generates a confirmation token using `Math.random()` (predictable), returns the token in the response body (line 20, 38), and logs it to stdout (line 36: `console.log('Confirmation email sent with token: ...')`).
- **Impact:** An attacker can trigger account deletions for any user, obtain the confirmation token, and confirm the deletion — enabling data destruction attacks. The token is also visible in server logs.
- **Safe Reproduction:** _Reproduction removed from the public copy until fixed._
- **Remediation:**
  1. Generate tokens with `crypto.randomBytes(32).toString('hex')` (cryptographically secure)
  2. Store only a SHA-256 hash of the token; compare on confirmation
  3. Never return the token in the API response — send it via email only
  4. Remove `console.log` of tokens; use structured logging with PII redaction
  5. Add rate limiting to prevent abuse
- **References:** CWE-330 (Use of Insufficiently Random Values), CWE-532 (Log Foraging), CWE-200 (Information Exposure); GDPR Art. 17 (Right to Erasure)

---

### F08 — MEDIUM: Supabase Service Role Key Bypasses RLS

- **CVSS v3.1:** 6.5 `AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N`
- **Severity:** Medium (currently limited to webhook handler)
- **Affected:** `services/database.ts:12-19`
- **Description:** The `DatabaseService` class authenticates to Supabase using the `SUPABASE_SERVICE_ROLE_KEY`, which bypasses all Row Level Security policies. Only `app/api/stripe/webhook+api.ts` and `netlify/functions/stripe-webhook.ts` import this module — the risk surface is currently limited. However, the service role key is referenced with an `EXPO_PUBLIC_` prefix in `feature-flags` routes (F25).
- **Impact:** If any client code acquires a reference to `services/database.ts`, it can read/write all Supabase tables without RLS enforcement.
- **Remediation:** Continue the current pattern of not importing `services/database.ts` from client code. Add lint rule: `@typescript-eslint/no-restricted-imports` on `@/services/database` with message "Server-only — use only from API routes".
- **References:** CWE-269 (Privilege Escalation); Supabase RLS documentation

---

### F09 — HIGH: Apple App Store Connect Credentials in eas.json

- **CVSS v3.1:** 7.2 `AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N`
- **Severity:** High
- **Affected:** `eas.json:117-122`
- **Description:** The `eas.json` build configuration contains hardcoded Apple credentials:
  - `appleId: "<REDACTED: owner Apple ID>"`
  - `ascAppId: "6748663048"`
  - `appleTeamId: "5D9V25DXPB"`
  - `ascApiKeyIssuerId: "c63babaa-12b6-4399-b0ff-d5fd3a04f404"`
  - `ascApiKeyId: "2F2UYP8DDP"`
- **Impact:** An attacker with repository access can authenticate to Apple's developer portal, access app metadata, manage test users, create provisioning profiles, and submit malicious builds to the App Store under the project's identity.
- **Remediation:**
  1. Remove all credentials from `eas.json`
  2. Use EAS credentials management: `eas credentials` CLI or the EAS dashboard
  3. Set credentials as GitHub Actions secrets and reference via `eas.json` environment variable interpolation
  4. Rotate the App Store Connect API key immediately
- **References:** CWE-312 (Cleartext Storage of Sensitive Information); CWE-798 (Hardcoded Credentials)

---

### F10 — MEDIUM: Overly Permissive Supabase RLS Policies on feature_flags

- **CVSS v3.1:** 5.6 `AV:N/AC:H/PR:H/UI:N/S:U/C:N/I:H/A:N` → **5.3** (adjusted for high complexity)
- **Severity:** Medium
- **Affected:** `supabase/migrations/20250630053126_billowing_valley.sql:47,64`; `supabase/migrations/20250902_complete_schema.sql:156`
- **Description:** 
  - `public.feature_flags` has `CREATE POLICY "Allow updates through function" ... FOR UPDATE USING (true)` — any authenticated user can update ANY feature flag directly via the database, bypassing the `SECURITY DEFINER` function `update_feature_flag`
  - `sm_feature_flags` has `CREATE POLICY "Allow public read access to feature flags" ... FOR SELECT USING (true)` — full read access to all feature flags including service-level ones
- **Impact:** Any authenticated user can flip feature flags (e.g., enable/disable compliance center, security monitoring, paid tier gates) without authorization.
- **Remediation:**
```sql
  DROP POLICY "Allow updates through function" ON public.feature_flags;
  CREATE POLICY "Feature flag updates via function only" ON public.feature_flags
    FOR UPDATE
    USING (auth.jwt()->>'role' = 'service_role')
    WITH CHECK (auth.jwt()->>'role' = 'service_role');
```
- **References:** CWE-269 (Privilege Escalation); CWE-862 (Missing Authorization)

---

### F11 — MEDIUM: `SECURITY DEFINER` Functions Without `search_path` Pinning

- **CVSS v3.1:** 5.9 `AV:N/AC:H/PR:L/UI:N/S:U/C:H/I:H/A:N`
- **Severity:** Medium
- **Affected:** `supabase/migrations/20250630053126_billowing_valley.sql:52-61`, `supabase/migrations/20250902_complete_schema.sql:171,189,236`
- **Description:** Four `SECURITY DEFINER` functions are defined without `SET search_path = public`:
  - `public.update_feature_flag` (20250630)
  - `create_virtual_cards_table_if_not_exists` (20250902)
  - `sm_update_feature_flag` (20250902)
  - `handle_new_user` (20250902)
  
  Only `20250701_rls_policy_wrappers.sql:18-19` pins `SET search_path = public` correctly.
- **Impact:** An attacker with write access to the `public` schema can create a table/function with the same name as one invoked inside the `SECURITY DEFINER` function. When executed with elevated privileges, the malicious object runs in the function's security context — a classic `search_path` injection attack.
- **Remediation:** Add `SET search_path = public` to all `SECURITY DEFINER` function definitions:
```sql
  CREATE OR REPLACE FUNCTION public.update_feature_flag(flag_name TEXT, flag_enabled BOOLEAN)
  RETURNS BOOLEAN AS $$
    SET search_path = public;
  BEGIN
    -- ...
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER;
```
- **References:** CWE-622 (Security Check Failure Due to Incorrect Variable Name / search_path injection); PostgreSQL security documentation

---

### F12 — MEDIUM: `check-env.js` Prints Environment Variables to Stdout

- **CVSS v3.1:** 5.3 `AV:N/AC:L/PR:N/UI:N/S:C/C:L/I:L/A:N`
- **Severity:** Medium
- **Affected:** `scripts/check-env.js`
- **Description:** The environment variable checker script prints variable values to stdout, which appear in CI logs.
- **Impact:** Environment variable values (including potentially sensitive config) visible in CI/CD logs.
- **Remediation:** Use masked variable references: `echo "SUPABASE_URL: $SUPABASE_URL"` → `echo "SUPABASE_URL: ***"` or use `--mask` annotations for GitHub Actions/Netlify.
- **References:** CWE-215 (Information Exposure Through Debug Information)

---

### F13 — MEDIUM: No Dependabot / SAST / SCA / Secret Scanning in CI

- **CVSS v3.1:** 5.3 `AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:H/A:N`
- **Severity:** Medium
- **Affected:** `.github/workflows/` — no security scanning workflows
- **Description:** The three CI workflows (`claude.yml`, `claude-code-review.yml`, `enhanced-eas-build.yml`, `pre-build-validation.yml`) contain no security scanning:
  - No Dependabot / Renovate for dependency updates
  - No SAST (SonarQube, CodeQL, Snyk Code)
  - No SCA (npm audit, Snyk, Dependabot)
  - No secret scanning (gitleaks, trufflehog, detect-secrets)
- **Impact:** Known vulnerabilities, outdated dependencies, and accidentally committed secrets go undetected.
- **Remediation:**
  1. Enable GitHub Dependabot: Settings → Code security & analysis → Dependabot Alerts → Enable
  2. Add CodeQL analysis:
```yaml
     - uses: github/codeql-action/init@v3
       with: { languages: [javascript] }
     - uses: github/codeql-action/analyze@v3
```
  3. Add secret scanning: `gitguardian/gitleaks-action@v1`
  4. Add `npm audit --audit-level=high` to CI pipeline
- **References:** CWE-1104 (Use of Unmaintained Third Party Modules); NIST SSDF practices

---

### F14 — MEDIUM: No Code-Signing Certificate in eas.json

- **CVSS v3.1:** 5.3 `AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:N`
- **Severity:** Medium
- **Affected:** `eas.json` — no `distribution: "store"` with certificate reference
- **Description:** The EAS build configuration does not specify an iOS distribution certificate or provisioning profile. Builds may default to ad-hoc distribution, which requires manual App Store Connect submission and review.
- **Impact:** Build integrity risk — without certificate pinning, builds could use development/ad-hoc certificates, and distribution to the App Store requires additional manual steps where substitution could occur.
- **Remediation:** Specify explicit certificate and provisioning profile in `eas.json` or use `eas credentials --platform ios --profile development` to generate and pin certificates.
- **References:** CWE-345 (Insufficient Verification of Data Authenticity)

---

### F15 — MEDIUM: Health Endpoint Leaks App Name + Timestamp

- **CVSS v3.1:** 3.7 `AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N`
- **Severity:** Medium
- **Affected:** `pages/api/health.js`, `netlify/functions/create-checkout-session.ts:42`
- **Description:** The health-check endpoints return the application name and an ISO timestamp in the response body. The `create-checkout-session` function also returns `uptime` and `timestamp` on GET requests.
- **Impact:** Information disclosure aids reconnaissance — confirms the application is live, provides timing data, and may reveal internal naming conventions.
- **Safe Reproduction:** _Reproduction removed from the public copy until fixed._
- **Remediation:** Return only `{"status":"ok"}` or `{"status":"ok","version":"<semver>"}`. Remove timestamps from public endpoints.
- **References:** CWE-200 (Information Exposure); CWE-131 (Incorrect Calculation of Buffer Size)

---

### F16 — MEDIUM: Floating GitHub Action Tags (`@v4`, `@beta`)

- **CVSS v3.1:** 5.3 `AV:N/AC:L/PR:N/UI:N/S:C/C:N/I:N/A:N`
- **Severity:** Medium
- **Affected:** All `.github/workflows/*.yml` — `uses: actions/checkout@v4`, `uses: anthropics/claude-code-action@beta`
- **Description:** All GitHub Actions use floating version tags (`@v4`, `@beta`). No SHA-pinning is used. The `@beta` tag on `anthropics/claude-code-action` is particularly dangerous — beta tags can be overwritten.
- **Impact:** Supply chain attack — an attacker who gains control of a repository referenced by a floating tag can inject malicious code into the CI pipeline.
- **Remediation:** Pin to full SHA:
```yaml
  uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11  # v4.1.1
  uses: anthropics/claude-code-action@<full-sha>
```
- **References:** CWE-1104 (Use of Unmaintained Third Party Module); SLSA supply chain framework

---

### F17 — MEDIUM: ESLint Major Version Mismatch

- **CVSS v3.1:** 3.1 `AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:L/A:N`
- **Severity:** Medium
- **Affected:** `package.json` — `@eslint/js@9` + `eslint@8` + `eslint-plugin-react-hooks@5`
- **Description:** The ESLint configuration mixes major versions: `@eslint/js@9.x`, `react-hooks@5.x`, but the core `eslint` is `8.x`. This will cause plugin compatibility issues and lint failures.
- **Impact:** Linting is broken or produces false negatives — security-relevant lint rules (no-eval, guard-for-in, etc.) may be silently disabled.
- **Remediation:** Upgrade all ESLint packages to v8.x or v9.x consistently. Use `npm dedupe` or `bun install --check`.
- **References:** CWE-354 (Improper Validation of Integrity Check Value)

---

### F18 — MEDIUM: `stripe` Package in devDependencies Instead of dependencies

- **CVSS v3.1:** 3.1 `AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:L/A:N`
- **Severity:** Medium
- **Affected:** `package.json`
- **Description:** The `stripe` SDK (v18.3.0) is listed under `devDependencies` but is imported by server-side code (`netlify/functions/`, `app/api/stripe/`, `services/`).
- **Impact:** In production deployment, the Stripe SDK may not be bundled, causing runtime `MODULE_NOT_FOUND` errors in API routes and Netlify Functions.
- **Remediation:** Move `stripe` from `devDependencies` to `dependencies`.
- **References:** CWE-829 (Inclusion of Functionality from Untrusted Control)

---

### F19 — HIGH: Interactive Shell Commands Leak Secrets

- **CVSS v3.1:** 7.2 `AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N`
- **Severity:** High
- **Affected:** `scripts/setup-*.sh` — multiple setup scripts
- **Description:** Multiple setup scripts use interactive `read` commands to collect secrets from the user, which are then `echo`ed to stdout or written with permissive file modes.
- **Impact:** Secret values visible in shell history, terminal output, and potentially CI log artifacts.
- **Remediation:**
  1. Use `read -s` for secret input to hide from terminal
  2. Never `echo` secrets — write directly to files with `umask 077`
  3. Pipe secrets from environment variables, not from stdin
  4. Add `set +a` after writing secrets to avoid history logging
- **References:** CWE-215 (Information Exposure Through Debug Information)

---

### F20 — LOW: ~67 PNG Screenshots + Coverage Directory Committed

- **CVSS v3.1:** 2.6 `AV:N/AC:H/PR:H/UI:N/S:U/C:L/I:N/A:N`
- **Severity:** Low
- **Affected:** Repo root — 37 PNGs at HEAD; `coverage/` directory — 30 files tracked
- **Description:** Despite `.gitignore` entries for coverage, ~37 PNG screenshots and 30 coverage files are tracked in git. The `.gitignore` does list `coverage/` but these files were added before the ignore rule or via `git add -f`.
- **Impact:** Repository bloat (scales with each test run). Screenshots may contain sensitive PII (user data, emails, credit card last-4 from Stripe mock responses).
- **Remediation:** `git rm -r --cached coverage/ *.png && git commit -m "chore: Remove test artifacts"`
- **References:** CWE-400 (Uncontrolled Resource Consumption)

---

### F21 — LOW: `build-result.json` Committed with Build Metadata

- **CVSS v3.1:** 3.3 `AV:N/AC:H/PR:H/UI:N/S:U/C:H/I:N/A:N`
- **Severity:** Low
- **Affected:** `build-result.json`
- **Description:** Contains build URLs, commit hashes, and actor identity — useful for attackers mapping the CI/CD pipeline and identifying the build environment.
- **Remediation:** `git rm --cached build-result.json`
- **References:** CWE-200 (Information Exposure)

---

### F22 — MEDIUM: `replit` Exposes Ports Externally

- **CVSS v3.1:** 5.3 `AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:N`
- **Severity:** Medium
- **Affected:** `.replit` — ports 5000/5001 exposed externally
- **Description:** The Replit configuration exposes internal development ports to the public internet.
- **Impact:** Internal services on ports 5000/5001 are directly accessible from the internet.
- **Remediation:** Remove `.replit` if not actively used. If used, bind to `127.0.0.1` and use tunneling.
- **References:** CWE-16 (Configuration)

---

### F23 — HIGH: AppleScript Injection in `core/safe_executor.py`

- **CVSS v3.1:** 7.5 `AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N`
- **Severity:** High
- **Affected:** `core/safe_executor.py:13,55` — if executed
- **Description:** Three Python files in `core/` are truncated fragments that fail to compile. However, `safe_executor.py` contains AppleScript generation with string interpolation: `f'tell application "{app_name}" to activate'` (line 13) and `set visible of application process "{app_name}" to false` (line 55). If `app_name` is attacker-influenced, this allows AppleScript injection.
- **Impact:** Remote code execution on macOS via AppleScript injection.
- **Remediation:** Remove dead `core/` files. If the executor is needed, implement proper shell-quote escaping or use AppleScript's `escape` utility.
- **References:** CWE-78 (OS Command Injection); CWE-94 (Code Injection)

---

### F24 — MEDIUM: No Confirmation for High-Risk MCP Tools

- **CVSS v3.1:** 4.3 `AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:H/A:N`
- **Severity:** Medium
- **Affected:** `config/mcp_tools.json:114-118` — `require_confirmation: {high: false, medium: false, low: false}`
- **Description:** MCP tool confirmation is disabled for all risk levels, including high-risk operations like `terminate`, `force_quit` (which ARE listed in `safety_rules.json` but overridden by the MCP config).
- **Impact:** AI agents or automated systems can execute destructive operations (kill processes, delete files) without user confirmation.
- **Remediation:** Set `require_confirmation: {high: true, medium: false, low: false}` at minimum.
- **References:** CWE-829 (Inclusion of Functionality from Untrusted Control)

---

### F25 — MEDIUM (Latent): `EXPO_PUBLIC_` Prefix on Service Role Key Would Leak to Client Bundle

- **CVSS v3.1:** 8.2 `AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:N`
- **Severity:** Medium (latent — protected by metro blocklist but NOT by webpack config)
- **Affected:** `app/api/feature-flags/index+api.ts:82`, `app/api/feature-flags/feature-flags-api-fixed.ts:82`
- **Description:** These routes read `process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`. The `EXPO_PUBLIC_` prefix means babel-preset-expo will inline the actual key value into any module that imports it. Metro blocklists `app/api/**` for React Native, BUT `webpack.config.js` (used for Expo web export) has **NO equivalent exclusion** for `app/api/**`. A future client-side import of either route would leak the service-role key into the published JavaScript bundle, granting full RLS bypass.
- **Impact:** If deployed via Expo web export (webpack) with the env var provisioned, the Supabase service role key becomes publicly accessible in the client bundle.
- **Safe Reproduction:** _Reproduction removed from the public copy until fixed._
- **Remediation:**
  1. Rename the env var to `SUPABASE_SERVICE_ROLE_KEY` (remove `EXPO_PUBLIC_` prefix)
  2. Add `app/api/**` exclusion to `webpack.config.js`:
```js
     config.module.rules.push({
       test: /app\/api\/.*/,
       use: 'null-loader',
     });
```
- **References:** CWE-798 (Hardcoded Credentials); CWE-312 (Cleartext Storage of Sensitive Information)

---

### F26 — LOW: Web Token Storage in Plaintext `localStorage`

- **CVSS v3.1:** 3.7 `AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N`
- **Severity:** Low
- **Affected:** `utils/webSecureStore.js:7,15` — `localStorage.setItem`/`getItem`
- **Description:** On web, `expo-secure-store` is aliased to a `localStorage` implementation. Supabase session tokens are stored in plaintext `localStorage`, accessible to any XSS payload.
- **Impact:** If an XSS vulnerability exists, the attacker can extract Supabase session tokens and impersonate users.
- **Remediation:** Use `sessionStorage` for shorter-lived tokens, implement Content-Security-Policy (F04), and consider cookie-based token storage with `httpOnly` flags where supported.
- **References:** CWE-79 (Cross-Site Scripting)

---

### F27 — MEDIUM: Client-Side-Only Paid Tier Gating

- **CVSS v3.1:** 5.3 `AV:N/AC:L/PR:N/UI:N/UI:N/S:U/C:N/I:H/A:N`
- **Severity:** Medium
- **Affected:** `components/monetization/FeatureGate.tsx` — `useSubscription().canAccessFeature`
- **Description:** Paid-tier feature access is controlled entirely client-side via `useSubscription().canAccessFeature`. No server-side validation exists.
- **Impact:** Any user can bypass paid-gate restrictions by modifying client-side code or calling protected API routes directly.
- **Remediation:** Add server-side subscription validation to every protected route:
```typescript
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan_type, status')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single();
  if (!['pro', 'enterprise'].includes(subscription?.plan_type)) {
    return new Response(JSON.stringify({ error: 'Upgrade required' }), { status: 403 });
  }
```
- **References:** CWE-862 (Missing Authorization)

---

### F28 — MEDIUM (Latent): `EXPO_PUBLIC_`-Prefixed Keys Bundled in Web Build

- **CVSS v3.1:** 4.3 `AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:L/A:N`
- **Severity:** Medium
- **Affected:** `config/compliance.ts` → `HAVEIBEENPWNED_API_KEY`; `services/splitwise.ts` → `SPLITWISE_API_KEY`
- **Description:** The Expo web webpack config (F25) has no `app/api/**` exclusion. Server-only API keys referenced in modules reachable from client-side code may ship in the web bundle (though the values will be `undefined` at runtime if not set). The `HAVEIBEENPWNED_API_KEY` is referenced by `components/compliance/` and `config/compliance.ts`, which are imported by the settings screen.
- **Remediation:** Add `app/api/**` exclusion to `webpack.config.js` (F25). Audit all `process.env.*` references that are not prefixed with `EXPO_PUBLIC_`.
- **References:** CWE-312 (Cleartext Storage of Sensitive Information)

---

## 6. Positive Controls Observed

The codebase also demonstrates several **well-implemented security practices**:

1. **Stripe webhook signature verification** — All three webhook handlers (`app/api/stripe/webhook+api.ts:289-308`, `app/api/connect/webhooks/authorization+api.ts:9-22`, `netlify/functions/stripe-webhook.ts:334-347`) properly verify signatures using `stripe.webhooks.constructEvent()`.
2. **Banking proxy auth** — `netlify/functions/banking-proxy.ts:55-73` validates the Supabase bearer token via `supabase.auth.getUser(accessToken)` with 401 enforcement.
3. **SSRF mitigation** — `lib/bankingProxy.ts` uses a strict path allowlist (`ALLOWED_BANKING_PROXY_PATHS`) with `path.posix.normalize` + `..` rejection — solid SSRF protection.
4. **Field allowlisting** — `services/subscriptionService.ts:109-133` uses explicit field allowlisting for updates — no mass assignment.
5. **Supabase RLS enabled** — RLS is enabled on `profiles`, `subscriptions`, `virtual_cards`, `card_authorizations`, `payment_records`, `bank_accounts` with `auth.uid()` scoping.
6. **Metro blocklist** — `metro.config.js` blocks `app/api/**` and `services/stripe-server.ts` from the React Native bundle.
7. **Server-only secrets** — `config/stripe.ts` keeps `secretKey`/`webhookSecret` server-side; client uses publishable key only.
8. **Conditional Sentry init** — `utils/sentry.ts` initializes Sentry only outside `__DEV__`.

---

## 7. Risk Register

| ID | Finding | CVSS | Likelihood | Impact | Risk Level |
|---|---|---|---|---|---|
| F01 | EAS Token in Git | 9.8 | Certain | Critical | **CRITICAL** |
| F02 | Unauth Virtual Card API | 9.1 | Certain | Critical | **CRITICAL** |
| F03 | AI Agent Prompt Injection | 7.5 | Probable | High | **HIGH** |
| F04 | Missing Security Headers | 7.2 | Certain | High | **HIGH** |
| F05 | Permissive CORS | 7.5 | Certain | High | **HIGH** |
| F06 | 23 Unauth API Routes | 9.1 | Probable (latent) | Critical | **CRITICAL** |
| F07 | GDPR Token Disclosure | 8.1 | Probable | High | **HIGH** |
| F09 | App Store Credentials | 7.2 | Probable | Critical | **HIGH** |
| F19 | Secret Leak in Scripts | 7.2 | Probable | High | **HIGH** |
| F11 | SECURITY DEFINER misconfig | 5.9 | Unlikely | High | **MEDIUM** |
| F08 | Service Role Key | 6.5 | Unlikely | High | **MEDIUM** |
| F13 | No Security Scanning | 5.3 | Certain | Medium | **MEDIUM** |
| F14 | No Code Signing | 5.3 | Unlikely | High | **MEDIUM** |
| F25 | EXPO_PUBLIC_ Service Key | 8.2 | Unlikely (latent) | Critical | **MEDIUM** |
| F27 | Client-Only Tier Gating | 5.3 | Certain | High | **MEDIUM** |
| F23 | AppleScript Injection | 7.5 | Unlikely (dead code) | High | **MEDIUM** |
| F24 | No MCP Confirmation | 4.3 | Probable | Medium | **MEDIUM** |
| F10 | Overly Permissive RLS | 5.3 | Probable | High | **MEDIUM** |
| F12 | Env Print in CI | 5.3 | Certain | Medium | **MEDIUM** |
| F18 | Stripe in devDeps | 3.1 | Probable | Medium | **MEDIUM** |
| F15 | Health Endpoint Leak | 3.7 | Certain | Low | **LOW** |
| F17 | ESLint Mismatch | 3.1 | Probable | Medium | **LOW** |
| F16 | Floating Tags | 5.3 | Probable | Medium | **MEDIUM** |
| F20 | Committed Artifacts | 2.6 | Certain | Low | **LOW** |
| F21 | build-result.json | 3.3 | Probable | Low | **LOW** |
| F22 | Exposed Ports | 5.3 | Unlikely | Medium | **MEDIUM** |
| F26 | Plaintext Web Tokens | 3.7 | Probable (XSS required) | Medium | **LOW** |
| F28 | Server Keys Bundled | 4.3 | Unlikely (latent) | Medium | **MEDIUM** |
---

## 8. 30/60/90-Day Remediation Roadmap

### Day 0-30 (Critical / High — Immediate)

| # | Action | Effort | Dependencies |
|---|---|---|---|
| 1 | **Rotate EAS token** in Expo Dashboard; remove from all docs; purge git history | 30 min | None |
| 2 | **Add auth** to `embedded-finance-virtual-cards.ts` — bearer token validation via Supabase | 2-4 hrs | None |
| 3 | **Add auth** to `create-checkout-session.ts` — validate userId against session | 1-2 hrs | None |
| 4 | **Add HTTP security headers** to `netlify.toml` (F04 remediation) | 30 min | None |
| 5 | **Fix CORS** — replace wildcard with explicit origin in all 3 functions | 30 min | None |
| 6 | **Remove App Store credentials** from `eas.json`; use EAS credentials management | 1 hr | Apple developer account access |
| 7 | **Remove `build-result.json`** from git tracking | 15 min | None |
| 8 | **Remove committed artifacts** — `coverage/` and PNG files from git | 30 min | None |
| 9 | **Remove `core/*.py`** dead code or fix compilation | 1-2 hrs | None |
| 10 | **Fix GDPR token handling** — crypto.randomBytes, SHA-256 hash, no console.log | 1 hr | None |
### Day 31-60 (Systemic — Medium)

| # | Action | Effort | Dependencies |
|---|---|---|---|
| 11 | Add auth middleware to all 23 latent `app/api/**` routes | 8-16 hrs | None |
| 12 | Add `app/api/**` exclusion to `webpack.config.js` | 30 min | None |
| 13 | Rename `EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` → `SUPABASE_SERVICE_ROLE_KEY` | 30 min | None |
| 14 | Add Supabase RLS hardening on `feature_flags` (F11 remediation) | 2 hrs | Database migration |
| 15 | Pin `SECURITY DEFINER` functions with `SET search_path = public` | 2 hrs | Database migration |
| 16 | Add Dependabot / SAST / secret scanning to CI | 2 hrs | None |
| 17 | Pin all GitHub Action versions to SHA | 1 hr | None |
| 18 | Add rate limiting to all API functions | 4 hrs | Upstash Rate Limit or similar |
| 19 | Move `stripe` from devDependencies to dependencies | 15 min | None |
| 20 | Fix ESLint version alignment | 1 hr | None |
| 21 | Set `require_confirmation: {high: true}` in `mcp_tools.json` | 15 min | None |
| 22 | Fix setup scripts — `read -s`, no echo of secrets | 2 hrs | None |
### Day 61-90 (Platform Hardening)

| # | Action | Effort | Dependencies |
|---|---|---|---|
| 23 | Implement server-side tier gating (F27) | 4-8 hrs | None |
| 24 | Implement web token storage hardening (F26) | 2-4 hrs | None |
| 25 | Add Content Security Policy (F04 extension) | 1 hr | None |
| 26 | Implement structured logging with PII redaction | 4 hrs | None |
| 27 | Generate SBOM (CycloneDX via `npm sbom` or `syft`) | 2 hrs | None |
| 28 | Add dependency vulnerability gating (`npm audit --audit-level=high` in CI) | 1 hr | None |
| 29 | Implement monitoring/alerting (Sentry alert rules, Netlify log streaming) | 4-8 hrs | Sentry/Netlify admin access |
| 30 | Document incident response procedure for key rotation | 2 hrs | None |
---

## 9. Compliance Gap Mapping

| Requirement | Gap | Compensating Control | Status |
|---|---|---|---|
| **SOC 2 CC6.1** — Logical access control | No server-side auth on API routes; no MFA enforcement | Supabase RLS enabled on core tables; banking proxy has auth | Partial |
| **SOC 2 CC6.6** — Security headers / XSS protection | No CSP, HSTS, X-Frame-Options | Supabase auth; Stripe hosted checkout | Gap |
| **SOC 2 CC6.7** — Data transmission encryption | HTTPS via Netlify/Vercel | TLS enforcement via HSTS (F04) | Partial |
| **SOC 2 CC6.8** — Secrets management | Hardcoded credentials in eas.json, git-tracked tokens | GitHub Actions secrets for CI; env var injection | Gap |
| **SOC 2 CC7.2** — Monitoring/logging | No structured logging, no alerting rules | Sentry for errors; basic console.log | Gap |
| **SOC 2 CC8.1** — Vulnerability management | No SAST/DAST/SCA in CI; no Dependabot | Manual code review | Gap |
| **ISO 27001 A.9** — Access control | No server-side auth on 23 routes; client-only tier gating | Supabase RLS; banking proxy auth | Partial |
| **ISO 27001 A.8.25** — Secure development | No CI security gates; no SBOM; no secret scanning | Git pre-commit hooks (none found) | Gap |
| **GDPR Art. 5(1)** — Data minimization | GDPR deletion/export returns sensitive tokens; audit log write-only-to-console | Supabase RLS; GDPR endpoints exist | Partial |
| **GDPR Art. 25** — Data protection by design | `Math.random()` for tokens; no SHA-256 hashing; server-side token exposure | GDPR endpoints present | Gap |
| **PCI-DSS 6.5** — Secure coding | No SAST; no dependency scanning; floating CI tags | Stripe hosted checkout reduces PCI scope | Partial |
| **PCI-DSS 8.3** — Strong authentication | No MFA; no session rotation | Supabase auth; banking proxy bearer tokens | Partial |
---

## 10. Closure Checklist

- [ ] F01: EAS token rotated and purged from git history
- [ ] F02: Auth added to `embedded-finance-virtual-cards.ts`
- [ ] F03: Actor allowlist + SHA-pinning on `claude.yml` and `claude-code-review.yml`
- [ ] F04: All 6 security headers added to `netlify.toml`
- [ ] F05: CORS wildcards replaced with explicit origins
- [ ] F06: All 23 latent routes secured with auth middleware
- [ ] F07: GDPR token uses `crypto.randomBytes`, SHA-256 hash, no console.log
- [ ] F08: Lint rule added to block `@/services/database` imports from client
- [ ] F09: App Store credentials removed from `eas.json`; API key rotated
- [ ] F10: RLS policies on `feature_flags` restricted to service_role
- [ ] F11: All 4 `SECURITY DEFINER` functions pinned with `search_path = public`
- [ ] F12: `check-env.js` uses masked variable references
- [ ] F13: Dependabot + CodeQL + secret scanning enabled in CI
- [ ] F14: Code signing certificate specified in `eas.json`
- [ ] F15: Health endpoints return minimal info only
- [ ] F16: All GitHub Actions pinned to full SHA
- [ ] F17: ESLint major versions aligned
- [ ] F18: `stripe` moved to dependencies
- [ ] F19: Setup scripts use `read -s`, no echo of secrets
- [ ] F20: Coverage directory and screenshots removed from git
- [ ] F21: `build-result.json` removed from git tracking
- [ ] F22: Replit ports removed or bound to localhost
- [ ] F23: Dead `core/*.py` files removed
- [ ] F24: MCP high-risk tool confirmation enabled
- [ ] F25: `EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` renamed; webpack blocklist added
- [ ] F26: Web token storage hardened (sessionStorage or httpOnly cookie consideration)
- [ ] F27: Server-side subscription validation on protected routes
- [ ] F28: `webpack.config.js` excludes `app/api/**`

---

## 11. SDLC & Platform Posture Recommendations

### SBOM Generation
- Generate CycloneDX SBOM on every build: `npx @cyclonedx/cyclonedx-npm --output-file sbom.json`
- Store in repository as `artifacts/sbom-${COMMIT}.json` or upload to a registry
- Alternative: SPDX format via `npm pkg set spdx=True`

### Dependency Scanning
- Enable GitHub Dependabot (vulnerability alerts + update PRs)
- Add `npm audit --audit-level=high --json` to CI with exit code failure on vulnerabilities
- Consider Snyk for deeper analysis and quarterly scan reporting

### Container/Image Scanning
- Not applicable (no Docker images in this project), but recommended if containerizing in the future
- Use `trivy` or `grype` for image scanning

### Secret Detection
- Add `gitguardian/gitleaks-action@v1` to CI
- Run `trufflehog filesystem` as a pre-commit hook
- Add `.gitleaksignore` for legitimate false positives

### Policy-as-Code
- Implement OPA/Conftest policies for `netlify.toml`, `eas.json`, `vercel.json`
- Example: policy to reject files containing `= sk_` or EAS-token-prefix patterns

### Least-Privilege IAM
- Separate GitHub Actions secrets per environment (production vs staging)
- Use GitHub Environments with required reviewers for production deployments
- Restrict `ANTHROPIC_API_KEY` to specific repo roles via GitHub's secret scanning alerts

### Monitoring & Alerting
- **Sentry**: Configure error alert rules for 5xx responses, Stripe webhook failures, Supabase errors
- **Netlify**: Enable Log Drives to send access/error logs to S3 or Datadog
- **Supabase**: Enable audit logging on core tables (profiles, subscriptions, virtual_cards)
- **Stripe**: Monitor webhook delivery dashboard; set up event routing to a monitoring endpoint
- **Open-source options**: Grafana + Prometheus (metrics), Loki (logs), Alertmanager (alerts)
- **Commercial options**: Datadog (all-in-one), New Relic, Mixpanel (analytics)

---

## 12. TestSprite-Aligned Executable Test Plan

Per the attached PRD (TestSprite — AI end-to-end testing platform) and `TESTSPRITE-SETUP.md`, this plan maps PRD features 4.1–4.7 and requirements 6.1–6.2 to concrete test cases against SUB-PRO. The PRD describes an AI end-to-end testing platform; this plan adapts those features as test **targets** for SUB-PRO on port 9995 (per `TESTSPRITE-SETUP.md` guidance to test a production build).

### Target: SUB-PRO on port 9995 (`bun nx start sub-pro` or `npx expo export -p web`)

### Test Plan Derivation from PRD Features

| PRD Feature | SUB-PRO Test Target | Test Cases |
|---|---|---|
| **4.1 AI-driven test generation** | Auth & Onboarding Flow | **TC001** — Sign up with valid credentials → redirected to dashboard |
| | | **TC002** — Sign in with valid credentials → session persisted on web |
| | | **TC003** — Sign in with invalid credentials → error message displayed (no user enumeration) |
| | | **TC004** — Password reset initiated → confirmation email/token flow |
| **4.2 Frontend testing** | UI Components & Navigation | **TC005** — Navigation from dashboard → subscriptions → billing works |
| | | **TC006** — FeatureGate UI correctly displays paid features for non-subscribers |
| | | **TC007** — Theme selector persists across sessions |
| **4.3 Backend testing** | API Routes & Functions | **TC008** — `/api/stripe/webhook` rejects invalid signatures (400) |
| | | **TC009** — `/api/stripe/webhook` accepts valid signatures (200) |
| | | **TC010** — `/api/banking/proxy` rejects requests without Authorization header (401) |
| | | **TC011** — `/api/banking/proxy` accepts valid bearer token, proxies request |
| | | **TC012** — `POST /api/compliance/gdpr/deletion-request` returns token in response body |
| | | **TC013** — `/api/stripe/create-checkout-session` creates session with valid body |
| **4.4 Unified dashboard** | Monitoring & Analytics | **TC014** — Health endpoint returns `{"status":"ok"}` without leaking app name |
| | | **TC015** — Marketplace track-click endpoint accepts request without auth |
| **4.5 Test scheduling** | Subscription Lifecycle | **TC016** — Subscription activation triggers correct feature flag state |
| | | **TC017** — Subscription cancellation removes access to paid features |
| **4.6 Git integration** | CI/CD Security | **TC018** — EAS build token is not present in any git-tracked file at HEAD |
| | | **TC019** — No `.env` files are git-tracked |
| **4.7 No-code interface** | User Experience | **TC020** — All error messages are user-friendly (no stack traces, no Stripe error codes) |
### Execution Guidance
- Run tests in small batches (TC001-TC005, TC006-TC010, etc.) per `TESTSPRITE-SETUP.md` Section 5
- Test against a production build (`bun nx build sub-pro`) rather than the dev server for payment flows (per `TESTSPRITE-SETUP.md` Section 7)
- Prioritize security-relevant tests: TC008-TC013 (auth, webhook verification, API security)
- After TestSprite validates test coverage, use results to validate remediation of findings F01-F28

---

*End of report. All findings verified via read-only analysis. No changes made to the repository.*
