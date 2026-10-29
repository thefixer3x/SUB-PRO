#!/bin/bash

# Subscription Manager Dependency Scanner
# This script finds all files that might break due to architecture changes

echo "🔍 Scanning for potential breaking points..."
echo "=========================================="

# Create results directory
mkdir -p scan-results
RESULTS_DIR="scan-results"

# 1. Find Supabase Feature Flag References
echo -e "\n📌 Scanning for Supabase feature flag references..."
grep -r "sm_feature_flags\|fetchFeatureFlags\|update_feature_flag\|feature_flags.*supabase" \
  --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" \
  --exclude-dir=node_modules --exclude-dir=.expo \
  . > "$RESULTS_DIR/supabase-feature-flags.txt" 2>/dev/null || true

# 2. Find API Route Imports
echo -e "\n🌐 Scanning for API route imports..."
grep -r "/api/\|fetch.*api/\|app/api" \
  --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" \
  --exclude-dir=node_modules --exclude-dir=.expo \
  . > "$RESULTS_DIR/api-routes.txt" 2>/dev/null || true

# 3. Find Stripe Direct Usage
echo -e "\n💳 Scanning for Stripe direct usage..."
grep -r "new Stripe\|stripe\.\|STRIPE_SECRET\|stripe.*issuing" \
  --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" \
  --exclude-dir=node_modules --exclude-dir=.expo \
  . > "$RESULTS_DIR/stripe-usage.txt" 2>/dev/null || true

# 4. Find Removed Package Imports
echo -e "\n📦 Scanning for removed package imports..."
grep -r "puppeteer\|playwright\|@stripe/stripe-js\|stripe-node" \
  --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" \
  --exclude-dir=node_modules --exclude-dir=.expo \
  . > "$RESULTS_DIR/removed-packages.txt" 2>/dev/null || true

# 5. Find Virtual Card Manager References
echo -e "\n💳 Scanning for Virtual Card Manager references..."
grep -r "VirtualCardManager\|createVirtualCard\|virtual.*card" \
  --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" \
  --exclude-dir=node_modules --exclude-dir=.expo \
  . > "$RESULTS_DIR/virtual-cards.txt" 2>/dev/null || true

# 6. Find Cancellation Bot References
echo -e "\n🤖 Scanning for Cancellation Bot references..."
grep -r "CancellationBot\|cancellation.*bot\|requestCancellation" \
  --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" \
  --exclude-dir=node_modules --exclude-dir=.expo \
  . > "$RESULTS_DIR/cancellation-bot.txt" 2>/dev/null || true

# 7. Find Server-Side Only Features
echo -e "\n🖥️ Scanning for server-side only features..."
grep -r "process\.env\.\(STRIPE\|WEAVR\|PLAID\)\|require.*stripe\|headless\|browser.*automation" \
  --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" \
  --exclude-dir=node_modules --exclude-dir=.expo \
  . > "$RESULTS_DIR/server-side-features.txt" 2>/dev/null || true

# 8. Find Import Statements from API folders
echo -e "\n📁 Scanning for imports from API folders..."
grep -r "from.*['\"].*api/\|import.*api/" \
  --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" \
  --exclude-dir=node_modules --exclude-dir=.expo \
  . > "$RESULTS_DIR/api-imports.txt" 2>/dev/null || true

# 9. Find Feature Flag Usage
echo -e "\n🚩 Scanning for feature flag usage..."
grep -r "isFeatureEnabled\|FEATURE_FLAGS\|featureFlags\[" \
  --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" \
  --exclude-dir=node_modules --exclude-dir=.expo \
  . > "$RESULTS_DIR/feature-flag-usage.txt" 2>/dev/null || true

# Generate Summary Report
echo -e "\n📊 Generating summary report..."
cat > "$RESULTS_DIR/SCAN_SUMMARY.md" << EOF
# Dependency Scan Results
Generated: $(date)

## Files Requiring Attention:

### 1. Supabase Feature Flags ($(wc -l < "$RESULTS_DIR/supabase-feature-flags.txt" | tr -d ' ') references)
\`\`\`
$(head -10 "$RESULTS_DIR/supabase-feature-flags.txt" 2>/dev/null || echo "None found")
\`\`\`

### 2. API Route Usage ($(wc -l < "$RESULTS_DIR/api-routes.txt" | tr -d ' ') references)
\`\`\`
$(head -10 "$RESULTS_DIR/api-routes.txt" 2>/dev/null || echo "None found")
\`\`\`

### 3. Direct Stripe Usage ($(wc -l < "$RESULTS_DIR/stripe-usage.txt" | tr -d ' ') references)
\`\`\`
$(head -10 "$RESULTS_DIR/stripe-usage.txt" 2>/dev/null || echo "None found")
\`\`\`

### 4. Removed Packages ($(wc -l < "$RESULTS_DIR/removed-packages.txt" | tr -d ' ') references)
\`\`\`
$(head -10 "$RESULTS_DIR/removed-packages.txt" 2>/dev/null || echo "None found")
\`\`\`

### 5. Virtual Card References ($(wc -l < "$RESULTS_DIR/virtual-cards.txt" | tr -d ' ') references)
\`\`\`
$(head -10 "$RESULTS_DIR/virtual-cards.txt" 2>/dev/null || echo "None found")
\`\`\`

### 6. Feature Flag Usage ($(wc -l < "$RESULTS_DIR/feature-flag-usage.txt" | tr -d ' ') references)
\`\`\`
$(head -10 "$RESULTS_DIR/feature-flag-usage.txt" 2>/dev/null || echo "None found")
\`\`\`

## Action Items:
1. Review each file in the scan results
2. Update imports to use new patterns
3. Replace API calls with Supabase Edge Function calls
4. Remove direct Stripe/secret key usage
5. Update components expecting server-side functionality

Full results available in: scan-results/
EOF

echo -e "\n✅ Scan complete! Results saved to: $RESULTS_DIR/"
echo "📄 View summary: cat $RESULTS_DIR/SCAN_SUMMARY.md"
echo "🔍 Check specific results: ls -la $RESULTS_DIR/"

# Show quick stats
echo -e "\n📊 Quick Stats:"
echo "- Supabase refs: $(wc -l < "$RESULTS_DIR/supabase-feature-flags.txt" | tr -d ' ')"
echo "- API routes: $(wc -l < "$RESULTS_DIR/api-routes.txt" | tr -d ' ')"
echo "- Stripe usage: $(wc -l < "$RESULTS_DIR/stripe-usage.txt" | tr -d ' ')"
echo "- Virtual cards: $(wc -l < "$RESULTS_DIR/virtual-cards.txt" | tr -d ' ')"
