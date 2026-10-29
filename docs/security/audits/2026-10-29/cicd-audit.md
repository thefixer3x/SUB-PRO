Compile the findings into a formal security audit report.

# Security Audit Report: SUB-PRO (SubTrack Pro)

**Scope:** CI/CD pipelines, deployment configuration, mobile build configuration, HTTP security headers, Netlify Functions  
**Repository:** `github.com/thefixer3x/SUB-PRO` (monorepo submodule: `seftechub-workspace`)  
**Architecture:** Expo (React Native + React Native Web) + expo-router + Supabase (Postgres + RLS) + Stripe (Connect + Issuing)  
**Deployment targets:** Netlify, Vercel, EAS mobile builds  
**Audit type:** READ-ONLY code review (no active probing of deployed services)  
**Date:** 2026-10-29  

---

## 1. Critical: Live EAS Robot Token Committed to Source Control

**Severity:** Critical  
**CVSS v3.1:** 9.8 Critical (AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H)  
**CWE:** CWE-798 (Use of Hard-coded Credentials)  
**CWE:** CWE-321 (Use of Hard-coded Cryptographic Key)

### Finding

A live EAS (Expo Application Services) robot token is committed at HEAD in the repository:

```
docs/integration/GITHUB-SECRETS-SETUP.md:14
EAS_ROBOT_TOKEN = <REDACTED: EAS robot token — rotated>
```
The git history confirms this was introduced in commit `f6b5989` ("Organize project documentation…"). The token was added to the committed `GITHUB-SECRETS-SETUP.md` at the same time it was accidentally committed to the `build-result.json` commit message, which itself documents a prior token exposure incident:

```json
"gitCommitMessage": "security: Remove exposed token and prevent future exposure\n\n- Add .claude/ to .gitignore to prevent accidental token exposure\n- Remove .claude/settings.local.json from git tracking\n- Token <REDACTED: EAS robot token — rotated> needs to be revoked"
```
This represents a **second occurrence** of the same token being exposed via documentation, suggesting the first remediation only removed the token from the `.claude/` directory but not from committed documentation files.

### Impact

The EAS robot token grants programmatic access to the owner's Expo account (`thefixer3x`), enabling:
- Triggering arbitrary mobile builds and OTA updates
- Accessing build artifacts (which may contain embedded secrets)
- Potentially submitting builds to app stores

### Safe Reproduction (Local)

_Reproduction removed from the public copy until fixed._

### Remediation

1. **Immediately revoke** the token at https://expo.dev/accounts/thefixer3x/settings/access-tokens
2. **Remove** the token from `GITHUB-SECRETS-SETUP.md` and from all git history (use `git filter-branch` or `BFG Repo-Cleaner`)
3. **Never** document real credentials in source files — use placeholder text only
4. Add a pre-commit secret scanner (e.g., `gitleaks`, `trufflehog`)

### OWASP Mapping
- OWASP Top 10 2021: A02:2021 – Cryptographic Failures
- ASVS 2.1: Authenticator Security – Hardcoded credentials

---

## 2. High: AI Agent (Claude Code Action) with Broad Repository Write Access

**Severity:** High  
**CVSS v3.1:** 7.5 High (AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:H)  
**CWE:** CWE-862 (Missing Authorization)  
**CWE:** CWE-250 (Execute with Unnecessary Privileges)

### Finding

Two workflows deploy the official `anthropics/claude-code-action@beta`:

**`claude-code-review.yml` (lines 36-38):**
```yaml
uses: anthropics/claude-code-action@beta
with:
  anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
  direct_prompt: |
    Please review this pull request and provide feedback on:
    - Code quality and best practices
    - Potential bugs or issues
    - Performance considerations
    - Security concerns
    - Test coverage
```
**`claude.yml` (lines 34-36):**
```yaml
uses: anthropics/claude-code-action@beta
with:
  anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
```
The `claude.yml` workflow is triggered by `issue_comment` (created), `pull_request_review_comment` (created), `issues` (opened, assigned), and `pull_request_review` (submitted). Both workflows declare `id-token: write` permission.

Per the official [claude-code-action security documentation](https://github.com/anthropics/claude-code-action/blob/main/docs/security.md), the action grants Claude **write access to repository contents** (contents: write), **pull requests** (write), and **issues** (write) via the GitHub App token. The `claude.yml` workflow declares `contents: read` in its own `permissions:` block, but the GitHub App's own installation grants write permissions that take precedence.

Critically, the `claude.yml` workflow uses `@claude` trigger phrases from **untrusted input** (PR comments, issue comments). On a public repository, external parties can inject prompts. The action documentation states: *"On public repos, you can also use `include_comments_by_actor` to allowlist which users' comments are passed to Claude."* This allowlist is **not configured**.

The `claude-code-review.yml` is triggered on `pull_request` types (opened, synchronize) — meaning **every PR from any contributor** triggers an autonomous AI agent that has access to the repository's secrets (via `${{ secrets.ANTHROPIC_API_KEY }}`).

### Impact

- Prompt injection in a PR comment could cause Claude to exfiltrate secrets, modify source files, or create unauthorized branches/PRs
- Every PR triggers AI review unconditionally (no `[skip-review]` gate active — it's commented out at lines 72-74)
- The `anthropics/claude-code-action@beta` tag is floating (not SHA-pinned)
- `ANTHROPIC_API_KEY` is available to every untrusted PR trigger

### Safe Reproduction (Local)

_Reproduction removed from the public copy until fixed._

### Remediation

1. Pin `anthropics/claude-code-action` to a **full SHA hash** (not `@beta`)
2. Add `include_comments_by_actor` allowlist to `claude.yml`
3. Add a `[skip-review]` trigger gate to `claude-code-review.yml` (uncomment lines 72-74)
4. Consider using `claude-code-action`'s `--allowedTools` to restrict Claude to read-only operations for automated reviews:
```yaml
   claude_args: '--allowedTools "Read,Glob,Grep,LS,mcp__github__*" --disallowedTools "TaskOutput,KillTask"'
```
5. Move `ANTHROPIC_API_KEY` to an **organization-level secret** and scope access, not just a repository secret

### OWASP Mapping
- OWASP Top 10 2021: A01:2021 – Broken Access Control
- ASVS 4.0: 2.1 – Authentication Credentials
- MASVS: MSTG-RESILIENCE – AI/ML input validation

---

## 3. High: Missing HTTP Security Headers on Netlify Deployment

**Severity:** High  
**CVSS v3.1:** 7.2 High (AV:N/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:N)  
**CWE:** CWE-693 (Protection Mechanism Failure)  
**CWE:** CWE-1021 (Improper Restriction of Rendered UI Layers or Frames)

### Finding

The SUB-PRO `netlify.toml` declares **zero** security headers for the main site or API routes. The only headers configured are cache-control on `/static/*`:

```toml
[[headers]]
  for = "/static/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
```
The **monorepo-level** `netlify.toml` (which applies to the `seftec-store` app, not SUB-PRO) correctly defines:

```toml
[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    X-XSS-Protection = "1; mode=block"
    Strict-Transport-Security = "max-age=63072000; includeSubDomains; preload"
    Content-Security-Policy = "..."
```
The SUB-PRO app is deployed to a **separate** Netlify site (confirmed by the URL `subtrack-pro.lanonasis.com` in `create-checkout-session.ts:49`), so the monorepo headers do **not** apply to it.

### Missing headers for SUB-PRO:

| Header | Present? |
|--------|----------|
| `Content-Security-Policy` | ❌ Missing |
| `X-Frame-Options` / `frame-ancestors` | ❌ Missing |
| `Strict-Transport-Security` | ❌ Missing |
| `X-Content-Type-Options` | ❌ Missing |
| `Referrer-Policy` | ❌ Missing |
| `Permissions-Policy` | ❌ Missing |
| `X-XSS-Protection` | ❌ Missing (legacy but still useful) |
### Impact

- No CSP → XSS, data injection, clickjacking
- No HSTS → vulnerable to SSL-stripping and man-in-the-middle
- No X-Frame-Options → clickjacking on financial interfaces (banking proxy, virtual cards)
- No Referrer-Policy → leak of subscription data via Referer header

### Safe Reproduction (Local)

_Reproduction removed from the public copy until fixed._

### Remediation

Add to `netlify.toml`:

```toml
[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "camera=(), microphone=(), geolocation=(), payment=()"
    # Add HSTS in Netlify site settings (requires DNS/SSL config)

[[headers]]
  for = "/*"
  [headers.values]
    Content-Security-Policy = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://*.supabase.co https://api.stripe.com https://*.lanonasis.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self';"
```
### OWASP Mapping
- OWASP Top 10 2021: A05:2021 – Security Misconfiguration
- ASVS 6.1 – HTTP Security Headers

---

## 4. High: Permissive CORS in Netlify Functions

**Severity:** High  
**CVSS v3.1:** 7.4 High (AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N)  
**CWE:** CWE-942 (Permissive Wildcard CORS)

### Finding

Three Netlify Functions use `Access-Control-Allow-Origin: '*'` with potentially sensitive data:

**`banking-proxy.ts:18`:**
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
};
```
**`create-checkout-session.ts:25,37,93`:**
```typescript
'Access-Control-Allow-Origin': '*',
```
**`embedded-finance-virtual-cards.ts:16`:**
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS,HEAD',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
};
```
The `banking-proxy.ts` endpoint accepts a `Bearer` token (line 47) and forwards authenticated requests to an upstream MCP API. The `create-checkout-session.ts` accepts user IDs and emails and processes Stripe payments. The `embedded-finance-virtual-cards.ts` exposes virtual card creation/management APIs. All are publicly accessible to any origin.

Additionally, `netlify.toml:40` declares:
```toml
[template.environment]
  EXPO_PUBLIC_SUPABASE_ANON_KEY = "Your Supabase Anon Key"
```
While this is a placeholder, the `EXPO_PUBLIC_*` prefix signals that these keys are embedded in the **client bundle**, making them visible to any page visitor (confirmed by `webpack.config.js:32-34` which defines them via `DefinePlugin`).

### Impact

- Any website can make authenticated banking proxy requests to the upstream API
- Any origin can invoke checkout sessions and virtual card management
- Supabase anon keys are baked into the JS bundle, enabling direct database access from any origin

### Safe Reproduction (Local)

_Reproduction removed from the public copy until fixed._

### Remediation

Replace wildcard with an allowlist of origins:

```typescript
// banking-proxy.ts
const ALLOWED_ORIGINS = new Set([
  'https://subtrack-pro.lanonasis.com',
  'https://www.subtrack-pro.lanonasis.com',
]);

const origin = event.headers.origin ?? event.headers.Origin ?? '';
if (ALLOWED_ORIGINS.has(origin)) {
  corsHeaders['Access-Control-Allow-Origin'] = origin;
}
// else: omit CORS headers entirely
```
### OWASP Mapping
- OWASP Top 10 2021: A01:2021 – Broken Access Control
- ASVS 4.0: 6.5 – CORS

---

## 5. Medium: Service Role Key Used in Server-Side Database Client

**Severity:** Medium  
**CVSS v3.1:** 6.5 Medium (AV:N/AC:L/PR:N/UI:N/S:C/C:L/I:L/A:N)  
**CWE:** CWE-269 (Improper Privilege Management)

### Finding

The `databaseService` class in `services/database.ts:19` initializes the Supabase client using the **service role key**:

```typescript
constructor() {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  // ...
  this.supabase = createClient<Database, 'public'>(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}
```
The service role key bypasses all Row-Level Security (RLS) policies. If the Supabase client is ever instantiated in a client-side context (which is possible given the `EXPO_PUBLIC_SUPABASE_URL` naming), the service role key would be exposed in the client bundle.

Additionally, `EXPO_PUBLIC_SUPABASE_URL` is named with the `EXPO_PUBLIC_` prefix (line 11 of `database.ts`), implying it's intended to be a client-side variable, but it's being used server-side. This naming is confusing and increases the risk of accidental misplacement.

### Impact

- Bypasses RLS — the webhook handler can update any user's subscription tier
- Naming confusion increases risk of key leakage to client bundles
- No error handling for database failures during subscription changes (silent failures at lines 57, 74, etc.)

### Remediation

1. Rename environment variable to `SUPABASE_URL` (remove `EXPO_PUBLIC_` prefix for server-only usage)
2. Ensure `SUPABASE_SERVICE_ROLE_KEY` is only used in server-side contexts (Netlify Functions, Edge Functions)
3. Implement proper error handling and retry logic for database operations
4. Add audit logging for all subscription tier changes

### OWASP Mapping
- OWASP Top 10 2021: A01:2021 – Broken Access Control (RLS bypass)
- ASVS 2.4 – Authorization

---

## 6. Medium: Hardcoded Physical Address in Virtual Card Creation

**Severity:** Medium  
**CVSS v3.1:** 5.3 Medium (AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:L/A:N)  
**CWE:** CWE-200 (Information Exposure)

### Finding

`embedded-finance-virtual-cards.ts:99-104`:

```typescript
billing: {
  address: {
    line1: '123 Main St',
    city: 'San Francisco',
    state: 'CA',
    country: 'US',
    postal_code: '94111',
  },
},
```
All Stripe Issuing cardholder objects are created with a hardcoded physical address. While this doesn't expose sensitive user data, it is:
1. A default/fake address that may not match the user's actual identity
2. Potentially problematic for financial compliance (KYC/AML requirements for virtual card programs)

### Impact

- Virtual cards created with mismatched identity information
- May trigger Stripe compliance reviews or account flags
- No user consent or awareness for the provided address

### Remediation

Collect the user's billing address from the authenticated session and pass it explicitly to the Stripe API.

### OWASP Mapping
- OWASP Top 10 2021: A02:2021 – Cryptographic Failures (identity verification)
- MASVS: MSTG-STORAGE – Sensitive data handling

---

## 7. Medium: `build-result.json` Committed to Repository

**Severity:** Medium  
**CVSS v3.1:** 5.3 Medium (AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N)  
**CWE:** CWE-200 (Information Exposure)

### Finding

`build-result.json` is tracked in git at HEAD. It contains:

```json
{
  "artifacts": {
    "buildUrl": "https://expo.dev/artifacts/eas/irikrPRdzS1pSJEGJCQ6W8.aab",
    "applicationArchiveUrl": "https://expo.dev/artifacts/eas/irikrPRdzS1pSJEGJCQ6W8.aab"
  },
  "gitCommitHash": "1769faed220036da3f1b19fa8be45597bbad2273",
  "gitCommitMessage": "security: Remove exposed token and prevent future exposure..."
}
```
This file is generated at runtime by the CI workflow (line 238 of `enhanced-eas-build.yml`: `> build-result.json`). It should be added to `.gitignore`.

### Impact

- Build artifact download URLs are publicly accessible
- Internal commit hashes and messages are exposed
- The file was apparently committed as a debugging artifact

### Remediation

Add to `.gitignore`:
```
build-result.json
```
### OWASP Mapping
- OWASP Top 10 2021: A01:2021 – Broken Access Control
- ASVS 12.4 – Error Handling

---

## 8. Medium: Floating Tag on `anthropics/claude-code-action` (Supply Chain)

**Severity:** Medium  
**CVSS v3.1:** 5.3 Medium (AV:N/AC:H/PR:N/UI:R/S:U/C:N/I:H/A:N)  
**CWE:** CWE-1104 (Use of Unmaintained Third Party Libraries)

### Finding

Both Claude workflows pin to `@beta`:

```yaml
uses: anthropics/claude-code-action@beta
```
A floating tag is mutable — anyone with push access to the `anthropics/claude-code-action` repo could modify what `@beta` points to. This is a supply-chain attack vector. All other CI actions in the monorepo use versioned tags (`@v4`, `@v3`) or floating major versions (`@v1`, `@v2`).

### Impact

- A compromised `@beta` tag could execute arbitrary code with access to all repository secrets
- No reproducibility of builds

### Remediation

Pin to a full SHA:
```yaml
uses: anthropics/claude-code-action@a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0
```
### OWASP Mapping
- OWASP Top 10 2021: A06:2021 – Vulnerable and Outdated Components
- ASVS 11.5 – Software and Components Integrity

---

## 9. Medium: Unpinned Third-Party CI Actions (Supply Chain)

**Severity:** Medium  
**CVSS v3.1:** 5.3 Medium (AV:N/AC:H/PR:N/UI:R/S:U/C:N/I:H/A:N)  
**CWE:** CWE-1104 (Use of Unmaintained Third Party Libraries)

### Finding

All actions used in the SUB-PRO workflows:

| Action | Version | Pinned? |
|--------|---------|---------|
| `actions/checkout` | `@v4` | Major only |
| `actions/setup-node` | `@v4` | Major only |
| `actions/upload-artifact` | `@v4` | Major only |
| `anthropics/claude-code-action` | `@beta` | Floating tag |
In the monorepo workflows, `actions/checkout@v3` is used (two occurrences in `monorepo-sync.yml`). All are major-version-only references. Best practice (and GitHub's own guidance) recommends SHA-pinning for critical supply-chain actions.

### Remediation

SHA-pin all actions, for example:
```yaml
uses: actions/checkout@a5ac7e51b41094c92402da3b24376905380afc29
```
### OWASP Mapping
- OWASP Top 10 2021: A06:2021 – Vulnerable and Outdated Components

---

## 10. Medium: `stripe` Package in `devDependencies` Instead of `dependencies`

**Severity:** Medium  
**CVSS v3.1:** 5.3 Medium (AV:N/AC:H/PR:N/UI:R/S:U/C:N/I:H/A:N)  
**CWE:** CWE-829 (Inclusion of Functionality Within Untrusted Control Sphere)

### Finding

```json
"devDependencies": {
  "stripe": "^18.3.0",
  ...
}
```
The `stripe` package is used in Netlify Functions (`create-checkout-session.ts`, `embedded-finance-virtual-cards.ts`, `stripe-webhook.ts`) and in `app/api/stripe/webhook+api.ts` at runtime. It should be in `dependencies`, not `devDependencies`. However, `legacy-peer-deps=true` in `.npmrc` means this may not cause actual installation failures.

### Impact

- On strict installations, Stripe SDK would not be installed for production, causing runtime failures
- Netlify Functions depend on it at runtime

### Remediation

Move `stripe` to `dependencies` in `package.json`.

### OWASP Mapping
- OWASP Top 10 2021: A06:2021 – Vulnerable and Outdated Components

---

## 11. Medium: Duplicate/Major-Mismatch ESLint Plugin Versions

**Severity:** Medium  
**CVSS v3.1:** 5.3 Medium (AV:N/AC:H/PR:N/UI:R/S:U/C:N/I:N/A:L)  
**CWE:** CWE-1104 (Use of Unmaintained Third Party Libraries)

### Finding

```
eslint                     8.57.1
@typescript-eslint/eslint-plugin   6.21.0
@typescript-eslint/parser          6.21.0
eslint-plugin-react                7.37.5
eslint-plugin-react-hooks          5.2.0   (v5 — uses eslint 9 schema)
eslint-plugin-react-native         5.0.0
@eslint/js                         9.37.0   (v9 — requires eslint 9)
eslint-config-expo                 10.0.0   (requires eslint >=8.10)
```
`@eslint/js@9.x` is installed alongside `eslint@8.x` and `eslint-plugin-react-hooks@5.x`. The `react-hooks@5.x` and `@eslint/js@9.x` are designed for ESLint 9 (flat config). This mismatch can cause rule conflicts, silent failures, or runtime errors during linting.

### Impact

- Linting may not catch issues due to incompatible plugin versions
- `npm run lint` may fail silently or error unpredictably

### Remediation

Align all ESLint plugins to a consistent major version (ESLint 9 flat config or stay on 8.x and downgrade plugins).

### OWASP Mapping
- OWASP Top 10 2021: A06:2021 – Vulnerable and Outdated Components

---

## 12. Medium: `.env` Files in `.archive/` Tracked in Git

**Severity:** Medium  
**CVSS v3.1:** 5.9 Medium (AV:N/AC:H/PR:N/UI:R/S:U/C:H/I:N/A:N)  
**CWE:** CWE-798 (Use of Hard-coded Credentials)

### Finding

The monorepo tracks `.env` files inside an archive directory:

```
.archive/worktrees/tmp-worktree-main/.env
.archive/worktrees/tmp-worktree-main/neon/.env
.archive/worktrees/tmp-worktree-main/packages/ui-kit/.env
```
While the values appear to be **placeholders** (all 13 values in the root `.env` have identical MD5 hashes — confirmed by computation), the file names and key names are exposed:
- `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `API_KEY_SALT`, `WEBHOOK_SECRET`, `PREMBLY_SECRET_KEY`, `NEON_DATABASE_URL`, `VPS_DATABASE_URL`

This is a **reconnaissance risk** — an attacker can enumerate environment variable names and target them.

### Impact

- Enumeration of sensitive configuration keys
- If the placeholder values were later replaced with real secrets, they would be committed

### Remediation

1. Ensure `.archive/` is in `.gitignore` at the root level
2. Or use `.git/info/exclude` to ignore it for this repo
3. Never store `.env` files in git history, even in `.archive/`

### OWASP Mapping
- OWASP Top 10 2021: A02:2021 – Cryptographic Failures
- ASVS 6.5.3 – Environment Variable Protection

---

## 13. Medium: No OTA Code-Signing Certificate Configured

**Severity:** Medium  
**CVSS v3.1:** 5.3 Medium (AV:N/AC:H/PR:N/UI:R/S:U/C:N/I:H/A:N)  
**CWE:** CWE-327 (Use of a Broken or Risky Cryptographic Algorithm)

### Finding

No `codeSigningCertificate` field is present in `eas.json` or `app.json`. Expo OTA updates require a code-signing certificate to sign the JavaScript bundle. Without it:
- OTA updates may be signed with a developer certificate that doesn't transfer between build environments
- Updates could be tampered with in transit if not properly verified

### Impact

- Vulnerable to OTA update tampering (MITM)
- OTA updates may fail on new machines/build agents

### Remediation

Configure an OTA code-signing certificate in `eas.json`:
```json
"cli": {
  "appVersionSource": "remote",
  "autoIncrement": true
},
"build": {
  "production": {
    "config": {
      "codeSigning": {
        "key": {
          "type": "fromEnv",
          "env": "EAS_PROJECT_KEY"
        }
      }
    }
  }
}
```
### OWASP Mapping
- MASVS: MSTG-CRYPTO – Secure OTA update signing

---

## 14. Low: Health Endpoint Leaks Internal Timestamp and Message

**Severity:** Low  
**CVSS v3.1:** 3.7 Low (AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:N/A:N)  
**CWE:** CWE-200 (Information Exposure)

### Finding

`pages/api/health.js`:
```javascript
export default function handler(request, response) {
  response.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    message: 'SubTrack Pro API is running'
  });
}
```
Exposes the application name ("SubTrack Pro") and a precise timestamp. While low-risk, it confirms the API is running and reveals the application product name.

### Impact

- Minor information disclosure (application name, uptime indicator via timestamp)

### Remediation

```javascript
response.status(200).json({ status: 'ok' });
```
### OWASP Mapping
- OWASP Top 10 2021: A01:2021 – Broken Access Control

---

## 15. Low: `setup-store-submission.sh` Interactive Secrets Entry via Command-Line History

**Severity:** Low  
**CVSS v3.1:** 3.1 Low (AV:L/AC:H/PR:N/UI:N/S:U/C:L/I:N/A:N)  
**CWE:** CWE-537 (Sensitive Information in Debug Output)

### Finding

`setup-store-submission.sh:48-67`:
```bash
read -p "Enter your LIVE Stripe Publishable Key (pk_live_...): " STRIPE_LIVE_KEY
eas secret:create --scope project --name STRIPE_LIVE_PUBLISHABLE_KEY --value "$STRIPE_LIVE_KEY"
```
Secrets are typed directly into the terminal via `read`, making them visible in:
- Shell history (`~/.zsh_history`)
- Process list (momentarily)
- Terminal emulator scrollback buffer

### Impact

- Secrets stored in shell history files
- Secrets visible in terminal history/log

### Remediation

Read from a protected file or use `read -s` (silent mode):
```bash
read -s -p "Enter your LIVE Stripe Publishable Key: " STRIPE_LIVE_KEY
echo  # newline
```
### OWASP Mapping
- OWASP Top 10 2021: A02:2021 – Cryptographic Failures

---

## 16. Low: `build-result.json` and Screenshots Committed to Repository

**Severity:** Low  
**CVSS v3.1:** 3.1 Low (AV:L/AC:H/PR:N/UI:N/S:U/C:L/I:N/A:N)  
**CWE:** CWE-1104 (Use of Unmaintained Third Party Libraries)

### Finding

The following are committed to git despite being build outputs and test artifacts:
- `build-result.json`
- `button-test-signin.png`
- `button-test-signup.png`
- `console-debug-screenshot.png`
- `detailed-dev-screenshot.png`, `detailed-dev-screenshot-2.png`
- `dev-server-screenshot.png`
- `direct-signin-test.png`
- `prod-build-test.png`
- `prod-server-screenshot.png`
- `signup-page-buttons.png`
- `signup-real-creds-after.png`
- `signup-real-creds-before.png`
- `signup-test-before.png`
- `simple-app-test.png`
- Full coverage output (`coverage/`)

The `.gitignore` does include `coverage/` at the root level and `dist/`, but the SUB-PRO submodule's `.gitignore` does not comprehensively cover these. The screenshot files (especially `signup-real-creds-after.png` and `signup-real-creds-before.png`) may contain UI screenshots with real-looking authentication data.

### Impact

- Bloated repository (screenshots and coverage data increase repo size)
- Possible exposure of sensitive UI states in screenshots
- Build artifacts mixed with source code

### Remediation

Add to `.gitignore`:
```
build-result.json
*.png
!assets/images/
coverage/
attached_assets/
```
### OWASP Mapping
- OWASP Top 10 2021: A01:2021 – Broken Access Control

---

## 17. Low: Monorepo Root Uses `bun` but SUB-PRO `package.json` Declares `npm`

**Severity:** Low  
**CVSS v3.1:** 3.1 Low (AV:L/AC:H/PR:N/UI:N/S:U/C:N/I:N/A:L)  
**CWE:** CWE-1104 (Use of Unmaintained Third Party Libraries)

### Finding

```json
"packageManager": "npm@9.8.1"
```
The monorepo root uses `bun.lock` and all CI workflows use `bun install` and `bun run`. The SUB-PRO `package.json` declares `npm@9.8.1` as its package manager, which is inconsistent. EAS CI builds explicitly run `npm ci` (line 196 of `enhanced-eas-build.yml`). This could lead to lock-file mismatches.

### Impact

- Potential dependency resolution differences between local (bun) and CI (npm)
- CI builds may install different dependency trees than local development

### Remediation

Update `package.json`:
```json
"packageManager": "npm@9.8.1",  // Change to: "bun@1.x"
```
### OWASP Mapping
- OWASP Top 10 2021: A06:2021 – Vulnerable and Outdated Components

---

## 18. Low: No Dependabot / No SAST/DAST / No Security Scanning in CI

**Severity:** Low  
**CVSS v3.1:** 3.1 Low (AV:N/AC:H/PR:L/UI:N/S:U/C:L/I:N/A:N)  
**CWE:** CWE-1104 (Use of Unmaintained Third Party Libraries)

### Finding

No Dependabot, Renovate, or similar automated dependency update configuration exists. The CI security audit step is a no-op:

```yaml
# enhanced-eas-build.yml:147-150
- name: Security audit
  run: |
    echo "🔒 Running security audit..."
    echo "Skipping npm audit in CI until dependency noise is resolved" || true
  continue-on-error: true
```
No SAST (SonarQube, CodeQL), no SCA (Snyk, Grype), no secret scanning (gitleaks, trufflehog), no DAST configuration.

### Impact

- Known vulnerabilities in dependencies go unpatched
- New vulnerabilities introduced via CI go undetected
- No automated dependency updates

### Remediation

1. Add `.github/dependabot.yml`
2. Enable Dependabot security alerts in repository settings
3. Add `npm audit` or `npx @safe-studio/cli` as a real CI step
4. Enable GitHub secret scanning via `gitleaks-github-action`

### OWASP Mapping
- OWASP Top 10 2021: A06:2021 – Vulnerable and Outdated Components

---

## 19. Informational: iOS Submission Credentials Hardcoded in `eas.json` and `sub-pro-ios-submit-config.json`

**Severity:** Low (Informational)  
**CVSS v3.1:** 3.1 Low  
**CWE:** CWE-200 (Information Exposure)

### Finding

The following **non-secret** but sensitive configuration is hardcoded:

**`eas.json:117-122`:**
```json
"ios": {
  "appleId": "<REDACTED: owner Apple ID>",
  "ascAppId": "6748663048",
  "appleTeamId": "5D9V25DXPB",
  "ascApiKeyPath": "./asc-api-key.p8",
  "ascApiKeyIssuerId": "c63babaa-12b6-4399-b0ff-d5fd3a04f404",
  "ascApiKeyId": "2F2UYP8DDP"
}
```
**`sub-pro-ios-submit-config.json:5`:**
```json
"appleId": "<REDACTED: owner Apple ID>"
```
These are **not secrets** themselves (email addresses, team IDs, API key IDs), but they are PII-adjacent data (personal email addresses) and internal infrastructure identifiers that should not be public.

### Impact

- Personal email addresses exposed (privacy risk under GDPR/CCPA)
- Apple team and API key identifiers exposed for targeted attacks

### Remediation

Move to `eas.json` secret references (`@EAS_APPLE_ID`) or environment variables.

### OWASP Mapping
- OWASP Top 10 2021: A01:2021 – Broken Access Control

---

## 20. Positive Security Controls Observed

Several security-best-practice elements were **correctly implemented**:

1. **Stripe Webhook Signature Verification** — `stripe-webhook.ts:334-348` and `app/api/stripe/webhook+api.ts:289-308` both properly verify the `stripe-signature` header using `stripe.webhooks.constructEvent()`. This is critical for preventing forged webhook events.

2. **Banking Proxy Authentication** — `banking-proxy.ts:44-75` validates Bearer tokens against Supabase before proxying requests. It requires authentication and returns `401` for invalid tokens.

3. **Banking Proxy Path Allowlisting** — `lib/bankingProxy.ts` uses a strict allowlist (`ALLOWED_BANKING_PROXY_PATHS`) and path normalization with `pathPosix.normalize()` to prevent path traversal. Only 7 specific upstream paths are routable.

4. **Supabase RLS Design** — The architecture uses Supabase with Row-Level Security (mentioned in scope). The `databaseService` constructor (line 14) throws if service role key is missing, preventing silent degradation.

5. **Service Role Key Separation** — The codebase distinguishes between `SUPABASE_ANON_KEY` (client) and `SUPABASE_SERVICE_ROLE_KEY` (server), following the principle of least privilege.

6. **Stripe API Key Server-Only** — The `STRIPE_SECRET_KEY` is never referenced with an `EXPO_PUBLIC_` prefix, keeping it server-only. This is correctly scoped.

7. **Stripe Checkout Source Validation** — `create-checkout-session.ts:49` validates the request origin against `SITE_URL` before constructing success/cancel URLs.

8. **Netlify Functions CORS on Netlify vs. API Routes** — Netlify Functions have CORS headers, but the native `app/api/` routes (Expo Router) handle CORS differently and are served from the same origin, reducing CORS risk on those endpoints.

9. **EAS Environment Variable Secrets** — The `eas.json` file references project-level EAS secrets via `@SECRET_NAME` syntax (e.g., `@SUPABASE_URL`, `@SUPABASE_ANON_KEY`), which is the recommended approach.

10. **Webpack Production Optimization** — `webpack.config.js:59-60` strips `console.log`, `console.info`, and `console.debug` in production builds, and sets `drop_debugger: true`, reducing information disclosure in client bundles.

---

## Summary Risk Register

| # | Title | Severity | CVSS v3.1 | Priority |
|---|-------|----------|-----------|----------|
| 1 | Live EAS Robot Token in Source Control | **Critical** | 9.8 | P0 — Immediately |
| 2 | AI Agent with Untrusted Input + Secret Access | **High** | 7.5 | P0 — Immediately |
| 3 | Missing HTTP Security Headers (Netlify) | **High** | 7.2 | P1 — This Sprint |
| 4 | Permissive CORS on Sensitive Netlify Functions | **High** | 7.4 | P1 — This Sprint |
| 5 | Service Role Key Usage | **Medium** | 6.5 | P1 — This Sprint |
| 6 | Hardcoded Address in Virtual Card Creation | **Medium** | 5.3 | P2 — Next Sprint |
| 7 | build-result.json Committed | **Medium** | 5.3 | P2 — Next Sprint |
| 8 | Floating Tag on claude-code-action | **Medium** | 5.3 | P2 — Next Sprint |
| 9 | Unpinned CI Actions (Supply Chain) | **Medium** | 5.3 | P2 — Next Sprint |
| 10 | stripe in devDependencies | **Medium** | 5.3 | P2 — Next Sprint |
| 11 | ESLint Plugin Version Mismatch | **Medium** | 5.3 | P2 — Next Sprint |
| 12 | .env Files in .archive/ Tracked | **Medium** | 5.9 | P2 — Next Sprint |
| 13 | No OTA Code-Signing Certificate | **Medium** | 5.3 | P2 — Next Sprint |
| 14 | Health Endpoint Information Leak | **Low** | 3.7 | P3 — Backlog |
| 15 | Interactive Secrets via CLI History | **Low** | 3.1 | P3 — Backlog |
| 16 | Screenshots/Coverage Committed | **Low** | 3.1 | P3 — Backlog |
| 17 | Package Manager Mismatch (bun vs npm) | **Low** | 3.1 | P3 — Backlog |
| 18 | No Security Scanning / Dependabot | **Low** | 3.1 | P2 — Next Sprint |
| 19 | iOS Submission Credentials in Config | **Low** | 3.1 | P3 — Backlog |
---

## Remediation Roadmap

### 30 Days (P0 + P1)
- [ ] Revoke EAS robot token `<REDACTED: EAS robot token — rotated>`
- [ ] Remove token from all git history (BFG Repo-Cleaner)
- [ ] Pin `claude-code-action` to SHA + add actor allowlist
- [ ] Add all missing HTTP security headers to `netlify.toml`
- [ ] Replace `Access-Control-Allow-Origin: *` with origin allowlist in all Netlify Functions

### 60 Days (P2)
- [ ] SHA-pin all CI actions
- [ ] Move `stripe` from devDependencies to dependencies
- [ ] Fix ESLint plugin version alignment
- [ ] Add `.gitignore` rules for build artifacts/screenshots
- [ ] Remove `.env` files from `.archive/`
- [ ] Add pre-commit gitleaks scan
- [ ] Configure Dependabot / Renovate

### 90 Days (P3 + Ongoing)
- [ ] Configure OTA code-signing certificate in EAS
- [ ] Align package manager (bun vs npm)
- [ ] Add npm audit to CI
- [ ] Add SAST (CodeQL) workflow
- [ ] Move iOS submission credentials to EAS secrets
- [ ] Sanitize health endpoint output
- [ ] Add `read -s` to secret-entry scripts

---

## Artifacts Reviewed

The following files were read in full during this audit:

### SUB-PRO Workflows
- `.github/workflows/claude-code-review.yml`
- `.github/workflows/claude.yml`
- `.github/workflows/enhanced-eas-build.yml`
- `.github/workflows/pre-build-validation.yml`

### SUB-PRO Deployment & Config
- `netlify.toml`
- `vercel.json`
- `app.json`
- `app.test.json`
- `eas.json`
- `sub-pro-ios-submit-config.json`
- `project.json`
- `.eslintrc.json`
- `.gitignore`
- `.npmrc`
- `.replit`
- `webpack.config.js`
- `metro.config.js`
- `babel.config.js`
- `tsconfig.json`
- `requirements.txt`
- `package.json`

### SUB-PRO Netlify Functions
- `netlify/functions/banking-proxy.ts`
- `netlify/functions/create-checkout-session.ts`
- `netlify/functions/embedded-finance-virtual-cards.ts`
- `netlify/functions/stripe-webhook.ts`
- `app/api/stripe/webhook+api.ts`
- `pages/api/health.js`

### SUB-PRO Services & Libs
- `services/database.ts`
- `services/stripe-server.ts`
- `lib/bankingProxy.ts`
- `utils/webSecureStore.js`

### SUB-PRO Scripts
- `scripts/setup-github-secrets.sh`
- `scripts/setup-eas-secrets.sh`
- `scripts/setup-secrets.sh`
- `scripts/setup-store-submission.sh`
- `scripts/check-env.js`
- `scripts/bump-runtime-version.js`
- `scripts/pre-build-check.sh`
- `scripts/build-for-stores.sh`
- `scripts/trigger-build.sh`
- `scripts/validate-workflow.sh`
- `scripts/deploy-sync.sh`
- `scripts/verify-deployment.sh`

### SUB-PRO Documentation
- `.env.example`
- `config/settings.json`
- `config/safety_rules.json`
- `config/mcp_tools.json`
- `build-result.json`
- `docs/integration/GITHUB-SECRETS-SETUP.md`

### Monorepo-Level
- `.github/workflows/ci.yml`
- `.github/workflows/i18n.yml`
- `.github/workflows/monorepo-sync.yml`
- `.github/instructions/nx.instructions.md`
- `netlify.toml` (monorepo)
- `.gitignore` (monorepo)
- `.env.template`
- `.env.central.example`
- `.mcp.json`
- `.gitmodules`
- `CLAUDE.md`

### Monorepo Archive
- `.archive/worktrees/tmp-worktree-main/.env`
- `.archive/worktrees/tmp-worktree-main/neon/.env`
- `.archive/worktrees/tmp-worktree-main/packages/ui-kit/.env`

### Other
- `.replit_integration_files/server/replit_integrations/chat/routes.ts`
- `.replit_integration_files/server/replit_integrations/batch/utils.ts`

---

**Audit Complete.** All findings are derived exclusively from source code review. No live systems were probed. The most urgent items (#1, #2) require immediate attention due to the exposure of a live credential and an AI agent with write access triggered by untrusted input.
