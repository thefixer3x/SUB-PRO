# 🚀 SUB-PRO Critical Stabilization & Deployment Guide

## ✅ **COMPLETED STEPS** (by AI Agent)

1. ✅ Created new branch: `fix/critical-stabilization-release`
2. ✅ Updated `.env` with production Stripe publishable key (local only - not committed)
3. ✅ Updated `eas.json` to disable mock auth in production profiles
4. ✅ Fixed `AuthContext.tsx` to only use mock auth when explicitly enabled via flag
5. ✅ Created Netlify function for Stripe Checkout (`netlify/functions/create-checkout-session.ts`)
6. ✅ Updated `netlify.toml` for proper web build and serverless functions
7. ✅ Fixed `usePayments.ts` hook to use real auth context and Netlify API

---

## 🎯 **YOUR ACTION ITEMS** (Execute in Order)

### **STEP 1: Login to EAS CLI** ⚡
```bash
eas login
# Enter credentials: thefixer3x / your password
eas whoami  # Verify
```

### **STEP 2: Set EAS Secrets** 🔐
**Critical:** These secrets are used during cloud builds (never committed to git):

```bash
cd /Users/seyederick/Development/SUB-PRO

# Stripe publishable key (safe to bundle in app)
eas secret:create --scope project --name EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY \
  --value "pk_live_51RBGUq2KF4vMCpn8m0UJW3YMyoWdTWee91EgbSj9nU6uNuQQOO8oPA7S57nuFfFVKO4O5ohKR7gdhQxovZmtKW9y00rSSLNFJB"

# Supabase public credentials
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL \
  --value "https://mxtsdgkwzjzlttpotole.supabase.co"

eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY \
  --value "***REMOVED-SUPABASE-CREDENTIAL***"

# API base URL (points to Netlify functions)
eas secret:create --scope project --name EXPO_PUBLIC_API_BASE_URL \
  --value "https://subtrack-pro.lanonasis.com/.netlify/functions"

# Disable mock auth in production
eas secret:create --scope project --name EXPO_PUBLIC_ENABLE_MOCK_AUTH \
  --value "false"

# Verify all secrets are set
eas secret:list
```

### **STEP 3: Set Netlify Secrets** 🔒
**Backend-only secrets** (NEVER exposed to client):

```bash
# Stripe SECRET key (backend only!)
netlify env:set STRIPE_SECRET_KEY "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"

# Supabase for backend functions
netlify env:set SUPABASE_URL "https://mxtsdgkwzjzlttpotole.supabase.co"
netlify env:set SUPABASE_ANON_KEY "***REMOVED-SUPABASE-CREDENTIAL***"

# 🔥 CRITICAL: Get your Stripe Price ID from dashboard
netlify env:set STRIPE_PRICE_PRO_MONTH "price_XXXXXXXXXXXXXXXX"  # REPLACE!

# Site URL for redirect
netlify env:set SITE_URL "https://subtrack-pro.lanonasis.com"

# Verify
netlify env:list
```

**🚨 TO GET STRIPE PRICE ID:**
1. Visit: https://dashboard.stripe.com/products
2. Click on "Pro Monthly" product
3. Copy the Price ID (e.g., `price_1Abc123...`)
4. Run the command above with your real Price ID

---

### **STEP 4: Simplify Tab Bar** (5 tabs instead of 9)

You can either:
- **Option A:** I provide you with a complete updated `_layout.tsx` 
- **Option B:** You manually consolidate the tabs

Let me know your preference. The goal:
- **Keep:** Dashboard, Cards, Groups, Activity, Account
- **Remove:** Subscriptions, Analytics, Marketplace, Upgrade, Reminder-Settings  
- **Merge features** into the 5 core tabs

---

### **STEP 5: Add Billing Success Page**

```bash
mkdir -p /Users/seyederick/Development/SUB-PRO/app/billing
```

Create file: `app/billing/success.tsx`
```tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { CheckCircle } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function BillingSuccess() {
  const { session_id } = useLocalSearchParams<{ session_id?: string }>();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <CheckCircle size={80} color="#10B981" />
        <Text style={styles.title}>Payment Successful!</Text>
        <Text style={styles.subtitle}>
          Your subscription is now active.
        </Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.replace('/(tabs)/home')}
        >
          <Text style={styles.buttonText}>Go to Dashboard</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 28, fontWeight: 'bold', marginTop: 24, color: '#1E293B' },
  subtitle: { fontSize: 16, color: '#64748B', marginTop: 8, textAlign: 'center' },
  button: { 
    backgroundColor: '#3B82F6', 
    paddingHorizontal: 32, 
    paddingVertical: 14, 
    borderRadius: 12, 
    marginTop: 32 
  },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
```

Then commit:
```bash
git add app/billing/
git commit -m "feat: add billing success/cancel pages"
```

---

### **STEP 6: Test Locally**

```bash
# Start Netlify dev (includes functions)
netlify dev

# Visit: http://localhost:8888
# Test:
# 1. Login with real Supabase user
# 2. Navigate around (check theme, tabs)
# 3. Click upgrade button
# 4. Verify Stripe Checkout opens
```

---

### **STEP 7: Deploy Web**

```bash
netlify deploy --build --prod

# Visit: https://subtrack-pro.lanonasis.com
# Test full flow: login → upgrade → Stripe → success page
```

---

### **STEP 8: Build & Submit Mobile**

#### iOS:
```bash
# Clean rebuild
rm -rf ios android
npx expo prebuild

# Build for store
eas build --platform ios --profile store-submission

# After build completes (~15-20 min), submit:
eas submit --platform ios --profile store-submission
```

#### Android:
```bash
eas build --platform android --profile store-submission
eas submit --platform android --profile store-submission
```

---

## 🧪 **QA CHECKLIST**

### Mobile (TestFlight/Internal Testing)
- [ ] Login works (no dummy data shown)
- [ ] 5 tabs visible and working
- [ ] Theme toggle persists
- [ ] Upgrade button opens Stripe in browser
- [ ] Can complete test payment

### Web (Netlify)
- [ ] Login works
- [ ] 5 tabs only
- [ ] Theme persists across routes
- [ ] Upgrade redirects to Stripe
- [ ] Success page shows after payment

---

## 📊 **Current Status**

| Component | Status | Action |
|-----------|--------|--------|
| `.env` | ✅ Updated locally | Don't commit |
| `eas.json` | ✅ Committed | Ready |
| `AuthContext` | ✅ Fixed | Ready |
| `usePayments` | ✅ Wired up | Ready |
| Netlify Function | ✅ Created | Ready |
| EAS Secrets | ⏳ TODO | Run Step 2 |
| Netlify Secrets | ⏳ TODO | Run Step 3 |
| Tab Bar | ⏳ TODO | Needs refactor |
| Billing Pages | ⏳ TODO | Create files |
| Mobile Build | ⏳ TODO | After above |
| Web Deploy | ⏳ TODO | After above |

---

## 🚨 **CRITICAL REMINDERS**

1. **NEVER commit Stripe secret key** to git
2. **Get real Stripe Price ID** from dashboard (Step 3)
3. **Test locally first** with `netlify dev`
4. **Use test card** for initial QA: `4242 4242 4242 4242`
5. **Check EAS build logs** if build fails: `eas build:list`

---

## 🎉 **AFTER SUCCESS**

Once all platforms are live:
1. Monitor Stripe Dashboard for payments
2. Check Supabase for user records
3. Set up Stripe webhooks (next phase)
4. Add crash monitoring (Sentry)
5. Enable OTA updates via EAS Update

---

## 📞 **TROUBLESHOOTING**

**EAS build fails:**
- Check: `eas build:list` for logs
- Verify: `eas secret:list` shows all secrets

**Netlify function error:**
- Check: Netlify Dashboard → Functions → Logs
- Verify: `netlify env:list` shows all variables

**Payment flow broken:**
- Test locally: `netlify dev`
- Check console for API errors
- Verify Price ID is correct

---

**Branch:** `fix/critical-stabilization-release`  
**Ready to merge after:** All QA passes ✅
