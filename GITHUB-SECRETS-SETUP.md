# GitHub Secrets Setup for SUB-PRO

## 🚨 URGENT: EAS Build Credits Running Low

Your $100 EAS plan expires soon and credits are nearly exhausted. This guide helps you configure GitHub secrets for automated deployments without wasting build credits.

## 🔑 Required GitHub Secrets

Navigate to: **SUB-PRO Repository** → **Settings** → **Secrets and variables** → **Actions**

### Core Authentication
```
EAS_ROBOT_TOKEN = <set-in-github-secrets>
```

### Supabase Configuration  
```
SUPABASE_URL = https://<your-project>.supabase.co
SUPABASE_ANON_KEY = <your-supabase-anon-key>
SUPABASE_PRODUCTION_URL = https://<your-prod-project>.supabase.co
SUPABASE_PRODUCTION_ANON_KEY = <your-prod-anon-key>
```

### Stripe Payments
```
STRIPE_PUBLISHABLE_KEY = <your-stripe-test-publishable-key>
STRIPE_LIVE_PUBLISHABLE_KEY = <your-stripe-live-publishable-key>
```

### AdMob Monetization
```
ADMOB_APP_ID = ca-app-pub-3940256099942544~3347511713
ADMOB_BANNER_ID = ca-app-pub-3940256099942544/6300978111
ADMOB_INTERSTITIAL_ID = ca-app-pub-3940256099942544/1033173712
ADMOB_REWARDED_ID = ca-app-pub-3940256099942544/5224354917

# Live AdMob (when ready for production)
ADMOB_LIVE_APP_ID = ca-app-pub-YOUR_LIVE_APP_ID~YOUR_LIVE_APP_ID
ADMOB_LIVE_BANNER_ID = ca-app-pub-YOUR_LIVE_APP_ID/YOUR_LIVE_BANNER_ID
ADMOB_LIVE_INTERSTITIAL_ID = ca-app-pub-YOUR_LIVE_APP_ID/YOUR_LIVE_INTERSTITIAL_ID
ADMOB_LIVE_REWARDED_ID = ca-app-pub-YOUR_LIVE_APP_ID/YOUR_LIVE_REWARDED_ID
```

### AdSense (Optional)
```
ADSENSE_PUBLISHER_ID = pub-YOUR_PUBLISHER_ID
ADSENSE_SLOT_ID = YOUR_SLOT_ID
```

## 🍎 iOS App Store Submission

**Current Issue**: eas.json has placeholder values for iOS submission.

### Fix Required:
1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Create new app entry for SUB-PRO
3. Get the App Store Connect App ID
4. Update eas.json:

```json
{
  "submit": {
    "production": {
      "ios": {
        "appleId": "<your-apple-id>",
        "ascAppId": "YOUR_ACTUAL_APP_ID_FROM_APP_STORE_CONNECT",
        "appleTeamId": "5D9V25DXPB"
      }
    }
  }
}
```

## 🚀 Zero-Credit Deployment Options

### Option 1: Manual Submission (Recommended)
```bash
# Download the existing successful build
# iOS: https://expo.dev/artifacts/eas/build-id.ipa
# Submit manually to App Store Connect
```

### Option 2: Automated Submission (Once secrets configured)
```bash
# Uses existing build, no new credits
eas submit --platform ios --id 4e42128c-61c4-4e07-8b39-faa30142bd4f
```

### Option 3: GitHub Workflow (Once secrets configured)
```bash
# Trigger build + submission via GitHub
gh workflow run enhanced-eas-build.yml -f platform=ios -f profile=production
```

## 📝 Steps to Complete Setup

1. ✅ **Workflows Fixed**: Updated to use Bun instead of npm
2. ⏳ **Add GitHub Secrets**: Copy secrets from list above
3. ⏳ **Get App Store Connect App ID**: Create app entry and get ID
4. ⏳ **Update eas.json**: Replace placeholder values with real App ID
5. ⏳ **Test Submission**: Use existing build for submission

## 💰 Credit Conservation

- **Current Status**: iOS build completed successfully (4e42128c-61c4-4e07-8b39-faa30142bd4f)
- **Credits Remaining**: Very low, plan expires soon
- **Strategy**: Use existing builds for submission, avoid new builds until necessary

## 🔧 Workflow Status

**Fixed Issues:**
- ✅ npm ci error → Now uses Bun consistently
- ✅ Pre-build validation → Updated to Bun setup
- ✅ EAS robot token → Already configured in CLAUDE.md

**Remaining Setup:**
- ⏳ GitHub secrets configuration
- ⏳ App Store Connect app creation
- ⏳ Real ascAppId in eas.json

Once these are configured, you'll have fully automated mobile deployment without burning additional EAS credits!
