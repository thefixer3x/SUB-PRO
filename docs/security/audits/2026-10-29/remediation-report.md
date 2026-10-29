

# SUB-PRO Security Remediation Report

**Scope**: `seftechub-workspace/apps/SUB-PRO` (Expo/React Native + Supabase + Stripe)
**Date**: 2026-10-29
**Confidentiality**: Read-only assessment. No production systems tested.

---

## FINDING #1 — CRITICAL (CVSS 9.8) Live EAS Robot Token Committed

**File**: `docs/integration/GITHUB-SECRETS-SETUP.md:14`
**Value**: `<REDACTED: EAS robot token>` (EAS publish token)

This token authenticates to Expo's API and can publish arbitrary code updates to your Expo Application Service (EAS) builds — effectively a full supply-chain compromise.

### Remediation

```bash
# Step 1: Revoke immediately on Expo dashboard
# Visit: https://expo.dev/settings/access-tokens
# Then revoke the compromised token

# Step 2: Remove from git history
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch docs/integration/GITHUB-SECRETS-SETUP.md' \
  --prune-empty --tag-name-filter cat -- --all

# Step 3: Push the cleaned history
git push origin main --force --all
git push origin --tags --force

# Step 4: Verify no trace remains
git log -p --all -S '<REDACTED: EAS robot token — rotated>' -- '*.md' | head -5
# Expected: no output

# Step 5: Install secret scanning in pre-commit
# Install: npm install --save-dev husky secret-scan-cli
# Add to package.json:
# "husky": { "hooks": { "pre-commit": "secret-scan --path ." } }
```
**References**: CWE-798 (Use of Hardcoded Credentials), CWE-214 (Information Exposure)

---

## FINDING #2 — HIGH (CVSS 7.5) Untrusted Input Triggers CI with API Key Access

**File**: `.github/workflows/claude-code-review.yml` (anthropics/claude-code-action@beta)

The Claude Code Action is triggered by PR comments and issue comments with full access to the `ANTHROPIC_API_KEY` secret. An untrusted commenter could abuse this for arbitrary LLM usage or prompt injection.

### Remediation

```yaml
# Edit: .github/workflows/claude-code-review.yml
# Add an actor allowlist and restrict trigger to repository members only

permissions:
  contents: read
  pull-requests: read

# Restrict triggers — remove 'issue_comment' unless you trust all commenters
on:
  pull_request:
    types: [opened, synchronize, reopened]
  # Remove: issue_comment:
    # types: [created]

# Add environment protection if using secrets
env:
  CODE_REVIEW_SCOPE: "review"  # Limit agent capabilities

# Add branch protection — only allow PR comments from maintainers
# Go to: Settings > Branches > Branch protection rules
# Enable: "Allow specified actors to bypass"
# Add your organization's maintainers group
```
**References**: CWE-94 (Improper Control of Generation of Code), CWE-862 (Missing Authorization)

---

## FINDING #3 — HIGH (CVSS 7.4) Zero HTTP Security Headers in SUB-PRO netlify.toml

**File**: `netlify.toml` (SUB-PRO's netlify.toml)

The SUB-PRO directory's netlify.toml defines zero security headers. The monorepo-level netlify.toml headers only apply to a different app in the workspace.

### Remediation

```toml
# Add to: apps/SUB-PRO/netlify.toml

[headers]
  # Apply to all edge functions and pages
  [headers.values]
    X-Content-Type-Options = "nosniff"
    X-Frame-Options = "DENY"
    X-XSS-Protection = "1; mode=block"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "camera=(), microphone=(), geolocation=(), payment=()"
    Content-Security-Policy = "default-src 'self'; script-src 'self' 'unsafe-inline' https://js.stripe.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://*.supabase.co https://api.stripe.com; frame-src https://js.stripe.com https://hooks.stripe.com; worker-src 'self' blob:; object-src 'none; base-uri 'self'; form-action 'self' https://js.stripe.com https://hooks.stripe.com"
    Strict-Transport-Security = "max-age=63072000; includeSubDomains; preload"

    # CORS for functions (more specific per-function headers below)
    Access-Control-Allow-Origin = "*"
    Access-Control-Allow-Methods = "GET, POST, OPTIONS"
    Access-Control-Allow-Headers = "Content-Type, Authorization, x-api-key"

# Per-function security header overrides
[[redirects]]
  from = "/.netlify/functions/stripe-webhook"
  to = "/.netlify/functions/stripe-webhook"
  status = 200
  force = true
  [redirects.headers]
    Access-Control-Allow-Origin = "*"
    # Remove Access-Control-Allow-Origin: * for webhook endpoint — use IP allowlist instead (see Finding #4)

[[redirects]]
  from = "/.netlify/functions/banking-proxy"
  to = "/.netlify/functions/banking-proxy"
  status = 200
  force = true
  [redirects.headers]
    Access-Control-Allow-Origin = "https://your-app-domain.com"
    Access-Control-Allow-Methods = "POST"
    Access-Control-Allow-Headers = "Content-Type, Authorization"

[[redirects]]
  from = "/.netlify/functions/create-checkout-session"
  to = "/.netlify/functions/create-checkout-session"
  status = 200
  force = true
  [redirects.headers]
    Access-Control-Allow-Origin = "https://your-app-domain.com"

[[redirects]]
  from = "/.netlify/functions/embedded-finance-virtual-cards"
  to = "/.netlify/functions/embedded-finance-virtual-cards"
  status = 200
  force = true
  [redirects.headers]
    Access-Control-Allow-Origin = "https://your-app-domain.com"
```
**References**: CWE-693 (Protection Mechanism Failure), OWASP A05:2021 Security Misconfiguration

---

## FINDING #4 — HIGH (CVSS 7.4) Wildcard CORS on 3 Sensitive Functions

**Files**:
- `api/functions/banking-proxy.ts` — wildcard `Access-Control-Allow-Origin: *`
- `api/functions/create-checkout-session.ts` — wildcard `Access-Control-Allow-Origin: *`
- `api/functions/embedded-finance-virtual-cards.ts` — wildcard `Access-Control-Allow-Origin: *`

These functions handle banking proxy auth, checkout creation, and virtual card management. Wildcard CORS allows any website to make cross-origin requests to these endpoints.

### Remediation

```typescript
// Fix in: apps/SUB-PRO/api/functions/banking-proxy.ts
// Find the response headers and replace wildcard with origin allowlist

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
  'https://your-app-domain.com',
  'https://app.your-app-domain.com'
];

// In your handler, before any processing:
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const origin = req.headers.origin || '';
  
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    // Reject unknown origins entirely
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');
    return res.status(200).end();
  }

  // ... rest of handler
}
```
```typescript
// Fix in: apps/SUB-PRO/api/functions/create-checkout-session.ts
// Same pattern — replace wildcard CORS with origin allowlist

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
  'https://your-app-domain.com'
];

// At start of handler function:
if (req.method === 'OPTIONS') {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return res.status(200).end();
}
```
```bash
# Add ALLOWED_ORIGINS environment variable to Netlify
# In netlify.toml or environment variable settings:
# ALLOWED_ORIGINS = https://your-app-domain.com,https://app.your-app-domain.com
```
**References**: CWE-942 (Permissive Cross-domain Communication), OWASP A01:2021 Broken Access Control

---

## FINDING #5 — MEDIUM (CVSS 6.5) Supabase Service Role Key Bypasses RLS

**File**: `services/database.ts`

The service role key is used in the database service, which bypasses all Row Level Security policies. If this key leaks, an attacker gains full database access.

### Remediation

```typescript
// Edit: apps/SUB-PRO/services/database.ts

// Use separate instances: anon key for client-side queries (with RLS)
// and service role key only where absolutely necessary
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Client-side: uses anon key with RLS enforced
export const createClientInstance = () => 
  createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Server-side: only use where RLS cannot be enforced (admin operations)
export const createServerClientInstance = () => 
  createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });

// Add middleware to audit service role usage
// File: apps/SUB-PRO/middleware/service-role-audit.ts
import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  if (req.headers.get('x-service-role') === 'true') {
    // Log service role access for audit
    console.warn(`Service role key used: ${req.nextUrl.pathname} at ${new Date().toISOString()}`);
  }
  return NextResponse.next();
}
```
**References**: CWE-269 (Improper Privilege Management), OWASP A01:2021 Broken Access Control

---

## FINDING #6 — MEDIUM (CVSS 5.3) Build Artifact URLs Committed to Git

**File**: `docs/build-result.json`

Contains URLs to build artifacts that could reveal internal build infrastructure details.

### Remediation

```bash
# Add to .gitignore
echo "docs/build-result.json" >> .gitignore

# Remove from git tracking
git rm --cached docs/build-result.json
git commit -m "chore: remove build artifacts from git"

# Add to docs/.gitignore as well if directory exists
```
**References**: CWE-200 (Information Exposure), CWE-732 (Incorrect Permission Assignment)

---

## FINDING #7 — MEDIUM (CVSS 5.3) Floating @beta Tag on CI Action

**File**: `.github/workflows/sha/claude-code-review.yml` (line referencing `anthropics/claude-code-action@beta`)

Using `@beta` means any commit tagged beta could introduce malicious code that runs in your CI with your API key.

### Remediation

```yaml
# Edit: .github/workflows/claude-code-review.yml
# Pin to a specific commit SHA, not a moving tag

- uses: anthropics/claude-code-action@a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0
  # Replace with the actual commit SHA you want to use
  with:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```
**References**: CWE-1104 (Use of Unmaintained Third Party Packages), CWE-829 (Unverified Software Download)

---

## FINDING #8 — MEDIUM (CVSS 5.3) Unpinned Third-Party CI Actions

All workflow files use unpinned versions (e.g., `@v4`, `@beta`) for third-party actions.

### Remediation

```yaml
# In every workflow file (*.yml), pin actions to specific SHAs

# Before (vulnerable):
- uses: actions/checkout@v4
- uses: actions/setup-node@v4

# After (secure):
- uses: actions/checkout@11bd71901bbe5b1639ce8dacef28f6abb3c1dcbb  # v4.1.7
- uses: actions/setup-node@60edb5dd545a775178f52524783378180af0d1f8  # v4.0.2

# To find current SHA versions:
# Visit: https://github.com/actions/checkout/releases
# Or use: gh release list --repo actions/checkout | head
```
**References**: CWE-1104 (Use of Unmaintained Third Party Packages), Supply Chain Risk

---

## FINDING #9 — MEDIUM (CVSS 5.3) `stripe` Package in devDependencies

**File**: `package.json`

The `stripe` npm package should be in `dependencies` for server-side use.

### Remediation

```json
// Edit: apps/SUB-PRO/package.json

{
  "dependencies": {
    // Move stripe here
    "stripe": "^17.0.0"
  },
  "devDependencies": {
    // Remove stripe from here if present
    "@types/node": "^20",
    "typescript": "^5"
  }
}

// Then reinstall:
npm install
```
**References**: CWE-1068 (Inconsistent Enforcement of Validated Constraints)

---

## FINDING #10 — MEDIUM (CVSS 5.3) ESLint Plugin Version Mismatch

**File**: `.eslintrc.json`

`@eslint/js@9` + `eslint-plugin-react-hooks@5` with `eslint@8` — version mismatch can cause unexpected behavior.

### Remediation

```json
// Edit: apps/SUB-PRO/.eslintrc.json

{
  "extends": [
    "next/core-web-vitals",
    "eslint:recommended"
  ],
  "plugins": [
    "react-hooks"
  ],
  "rules": {
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn"
  },
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaVersion": 2022,
    "sourceType": "module",
    "ecmaFeatures": {
      "jsx": true
    }
  }
}

// Upgrade eslint ecosystem:
npm install --save-dev eslint@9 @eslint/js@9 eslint-plugin-react-hooks@5
```
**References**: CWE-1068 (Inconsistent Enforcement)

---

## FINDING #11 — MEDIUM (CVSS 6.5) .env Files Tracked in Archive with Sensitive Var Names

**File**: `.archive/worktrees/`

Contains references to 13 environment variable names including `JWT_SECRET`, `API_KEY_SALT`, `PREMBLY_SECRET_KEY`. While the archive may not contain live values, the presence of these names could inform attacks.

### Remediation

```bash
# Add archive directory to gitignore
echo ".archive/" >> .gitignore
git rm -r --cached .archive/
git commit -m "chore: remove archived worktrees from git"

# Verify no secrets leaked
git log -p --all -S 'JWT_SECRET' -- '*.ts' '*.js' '*.env*' | head -20
```
**References**: CWE-200 (Information Exposure)

---

## FINDING #12 — MEDIUM (CVSS 5.3) No OTA Code-Signing Certificate in eas.json

**File**: `eas.json`

Over-the-air updates without code signing can allow man-in-the-middle injection of malicious JS bundles.

### Remediation

```json
// Edit: apps/SUB-PRO/eas.json

{
  "cli": {
    "version": ">= 12.0.0",
    "appVersionSource": "remote"
  },
  "build": {
    "production": {
      "channel": "production",
      "distribution": "store",
      "ios": {
        "resourceConfiguration": "./ios/ResourceConfig.json",
        "badge": true,
        "autoIncrement": true
      },
      "android": {
        "buildType": "apk"
      }
    },
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "simulator": {
      "extends": "development",
      "ios": {
        "simulator": true
      }
    }
  },
  "submit": {
    "ios": {
      "acrossIosAndAppPlans": true
    }
  }
}

// Enable OTA code signing in app.json:
{
  "expo": {
    "updates": {
      "url": "https://u.expo.dev/YOUR-PROJECT-ID",
      "enabled": true,
      "checkAutomatically": "on-mount",
      "fallbackToCacheTimeout": 30000,
      "codeSigningCertificate": "./path/to/cert.p12",
      "codeSigningMetadata": {
        "keyid": "default",
        "alg": "ES256"
      }
    }
  }
}
```
**References**: CWE-345 (Insufficient Verification of Data Authenticity), OWASP MASVS Msth8

---

## FINDING #13 — LOW (CVSS 3.7) Health Endpoint Information Disclosure

**File**: `api/functions/health.ts` (approximate)

Returns app name and timestamp, potentially revealing deployment details.

### Remediation

```typescript
// Edit: apps/SUB-PRO/api/functions/health.ts

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only return minimal, non-sensitive health info
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    // Remove: app name, version, uptime, environment details
  });
}
```
**References**: CWE-200 (Information Exposure)

---

## FINDING #14 — LOW (CVSS 3.7) Interactive Scripts with Secret Prompts

Scripts like `setup-github-secrets.sh`, `setup-eas-secrets.sh`, `setup-secrets.sh` use `read` prompts that leak secrets to shell history.

### Remediation

```bash
# Edit: setup-github-secrets.sh (and similar scripts)

# BEFORE (insecure — reads from terminal, visible in shell history):
read -s -p "Enter GitHub token: " GITHUB_TOKEN

# AFTER (use environment variables or GitHub CLI):
GITHUB_TOKEN=${GITHUB_TOKEN:-$(gh auth token 2>/dev/null)}

if [ -z "$GITHUB_TOKEN" ]; then
  echo "Error: GITHUB_TOKEN not set in environment and gh CLI not authenticated" >&2
  exit 1
fi

# Use set -o history to disable history for secret entries
set -o history
read -s -p "Enter secret: " SECRET_VAR
set +o history
```
**References**: CWE-798 (Hardcoded Credentials)

---

## FINDING #15 — LOW (CVSS 3.7) PNG Screenshots Committed to Git

~30 PNG screenshot files are committed despite .gitignore (likely in subdirectories without .gitignore coverage).

### Remediation

```bash
# Find all PNG files in the repo
find apps/SUB-PRO -name "*.png" -type f

# Check which are tracked
find apps/SUB-PRO -name "*.png" -type f -exec git ls-files --error-unmatch {} \;

# Remove tracked PNGs from git (keeps them on disk):
git rm --cached $(git ls-files | grep '\.png$')

# Add comprehensive .gitignore at repo root:
cat >> .gitignore << 'EOF'
*.png
*.jpg
*.jpeg
*.gif
*.svg
screenshots/
__screenshots__/
coverage/
EOF

git commit -m "chore: remove screenshot assets from git tracking"
```
**References**: CWE-1104 (Use of Unmaintained Third Party Packages)

---

## FINDING #16 — LOW (CVSS 3.7) Package Manager Mismatch

Monorepo uses `bun` but SUB-PRO declares `npm` in packageManager.

### Remediation

```json
// Check packageManager in apps/SUB-PRO/package.json
// Ensure it matches your monorepo configuration

{
  "packageManager": "bun@1.1.38"  // or "npm@10.x" or "pnpm@8.x"
}

// Align with monorepo root
cat package.json | grep packageManager
```
**References**: CWE-1068 (Inconsistent Enforcement)

---

## FINDING #17 — LOW (CVSS 3.7) No Dependency Scanning in CI

No Dependabot, Renovate, SAST, DAST, or secret scanning configured.

### Remediation

```yaml
# Add to .github/workflows/
# File: .github/workflows/dependency-review.yml

name: Dependency Review
on: [pull_request]

permissions:
  contents: read

jobs:
  dependency-review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11bd71901bbe5b1639ce8dacef28f6abb3c1dcbb
      - uses: actions/dependency-review-action@3b238a23c8fa64f3e1866c472a828adf5d4bc2a5
        with:
          fail-on-severity: high
```
```yaml
# Add secret scanning workflow
# File: .github/workflows/secret-scanning.yml

name: Secret Scanning
on: [push, pull_request]

permissions:
  contents: read

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11bd71901bbe5b1639ce8dacef28f6abb3c1dcbb
        with:
          fetch-depth: 0
      - uses: trufflesecurity/trufflehog@main
        with:
          extra_args: --only-verified
```
**References**: CWE-1104 (Use of Unmaintained Third Party Packages)

---

## FINDING #18 — LOW (CVSS 3.7) iOS Submission Credentials Hardcoded

**File**: `eas.json:117-122`

Personal email, team ID, and Apple ID details are hardcoded.

### Remediation

```json
// Edit: apps/SUB-PRO/eas.json

{
  "submit": {
    "ios": {
      "appleId": "$APPLE_ID",          // Use environment variable reference
      "ascAppId": "$ASC_APP_ID",       // Use environment variable reference
      "appleTeamId": "$APPLE_TEAM_ID", // Use environment variable reference
      "keyId": "$KEY_ID",
      "issuerId": "$ISSUER_ID"
    }
  }
}

// Store in environment:
# On CI/CD: Use Netlify/GitHub Actions secrets
# Locally: Use .env file (add to .gitignore)
# OR use EAS project credentials:
npx eas credentials --platform ios --configure
```
**References**: CWE-798 (Use of Hardcoded Credentials)

---

## Positive Controls Observed (No Action Required)

1. **Stripe webhook signature verification** — `stripe-webhook.ts` verifies signatures before processing
2. **Banking proxy Bearer token auth** with path allowlisting protects sensitive endpoints
3. **Service role key separation** from anon key in database service
4. **EAS secret references via `@SECRET_NAME` syntax** in workflow files (good practice)
5. **Webpack production console stripping** prevents debug output in production builds

---

## Remediation Priority Matrix

| Priority | Findings | Estimated Effort |
|----------|----------|-----------------|
| **P0 — Immediate (within 24h)** | #1 (EAS token), #2 (claude-code-action) | 1–2 hours |
| **P1 — Critical (within 1 week)** | #3 (security headers), #4 (CORS), #5 (service role) | 4–8 hours |
| **P2 — Important (within 1 month)** | #6–#12 | 8–16 hours |
| **P3 — Planned (next sprint)** | #13–#18 | 4–8 hours |
---

## OWASP Top 10 Mapping

| Finding | OWASP Category |
|---------|---------------|
| #1, #14, #18 | A07:2021 Identification and Authentication Failures |
| #2 | A01:2021 Broken Access Control |
| #3, #4 | A05:2021 Security Misconfiguration |
| #5 | A01:2021 Broken Access Control |
| #6, #11, #13 | A02:2021 Cryptographic Failures |
| #7, #8, #17 | A06:2021 Vulnerable and Outdated Components |
| #9, #10 | A05:2021 Security Misconfiguration |
| #12 | A09:2021 Security Logging and Monitoring Failures |
