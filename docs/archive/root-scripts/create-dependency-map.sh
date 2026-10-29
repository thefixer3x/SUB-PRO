#!/bin/bash

# Quick Component Dependency Mapper
echo "🗺️  Creating Component Dependency Map..."

# Create visual map directory
mkdir -p dependency-maps

# Find all components and their imports
echo "digraph Dependencies {" > dependency-maps/component-graph.dot
echo "  rankdir=LR;" >> dependency-maps/component-graph.dot
echo "  node [shape=box, style=rounded];" >> dependency-maps/component-graph.dot

# Components that need attention
echo "  // High-risk components" >> dependency-maps/component-graph.dot
echo "  VirtualCardManager [style=filled, fillcolor=red];" >> dependency-maps/component-graph.dot
echo "  CancellationBot [style=filled, fillcolor=red];" >> dependency-maps/component-graph.dot
echo "  FeatureFlagsContext [style=filled, fillcolor=yellow];" >> dependency-maps/component-graph.dot

# Find import relationships
for file in $(find . -name "*.tsx" -o -name "*.ts" | grep -E "(components|app|lib|hooks)" | grep -v node_modules); do
  base_name=$(basename "$file" .tsx | sed 's/\.ts$//')
  
  # Find what this file imports
  grep -E "^import.*from ['\"]" "$file" 2>/dev/null | while read -r line; do
    if echo "$line" | grep -q "@/"; then
      imported=$(echo "$line" | sed -E "s/.*from ['\"]@\/([^'\"]+).*/\1/" | sed 's/\/.*//')
      echo "  \"$base_name\" -> \"$imported\";" >> dependency-maps/component-graph.dot
    fi
  done
done

echo "}" >> dependency-maps/component-graph.dot

# Create a simple text-based dependency list
cat > dependency-maps/CRITICAL_DEPENDENCIES.md << 'EOF'
# Critical Dependencies to Update

## 🔴 High Priority (Breaking Changes)

### 1. Virtual Card Manager
**Files:**
- `/components/finance/VirtualCardManager.tsx`
- `/app/api/embedded-finance/virtual-cards/create+api.ts`
- `/hooks/useVirtualCards.ts`

**Issues:**
- Direct Stripe API usage with secret keys
- API routes won't work in production
- PCI compliance violation

**Fix:**
```typescript
// Replace: 
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// With:
import { secureAPI } from '@/lib/secure-api';
await secureAPI.createVirtualCard({ subscriptionId, limit });
```

### 2. Cancellation Bot
**Files:**
- `/components/automation/CancellationBot.tsx`
- `/app/api/embedded-finance/cancellation/*`
- `/services/browserAutomation.ts`

**Issues:**
- Puppeteer/Playwright won't work in Expo
- Requires server-side execution

**Fix:**
```typescript
// Replace:
import puppeteer from 'puppeteer';

// With:
await secureAPI.requestCancellation({ vendor, subscriptionId });
```

## 🟡 Medium Priority (Functionality Changes)

### 3. Feature Flags System
**Files:**
- `/contexts/FeatureFlagsContext.tsx` ✅ (Already fixed)
- `/hooks/useFeatureFlags.ts`
- Any component using `featureFlags`

**Check for:**
- References to `sm_feature_flags` table
- Supabase RPC calls for feature flags
- API route calls to `/api/feature-flags`

### 4. GDPR/Compliance Tools
**Files:**
- `/components/compliance/GDPRExport.tsx`
- `/app/api/compliance/*`

**Issues:**
- Server-side data processing required
- Audit logging must be server-side

## 🟢 Low Priority (Simple Updates)

### 5. Import Path Updates
- Update any `fetch('/api/...')` calls
- Replace removed package imports
- Update environment variable usage

## 📋 Quick Check Commands

```bash
# Find all fetch API calls
grep -r "fetch.*['\"]\/api" --include="*.tsx" --include="*.ts" .

# Find Stripe references
grep -r "stripe\." --include="*.tsx" --include="*.ts" .

# Find removed packages
grep -r "puppeteer\|playwright" --include="*.tsx" --include="*.ts" .
```
EOF

echo "✅ Dependency maps created!"
echo ""
echo "📊 View results:"
echo "1. Text summary: cat dependency-maps/CRITICAL_DEPENDENCIES.md"
echo "2. Visual graph: dependency-maps/component-graph.dot"
echo ""
echo "💡 To visualize the graph (if you have graphviz):"
echo "   dot -Tpng dependency-maps/component-graph.dot -o dependency-maps/graph.png"
