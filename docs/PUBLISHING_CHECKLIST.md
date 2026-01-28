# SubTrack Pro - App Store Publishing Checklist

> Last Updated: January 2026

## Pre-Submission Requirements

### 1. Apple Developer Account
- [ ] Active Apple Developer Program membership ($99/year)
- [ ] Access to [App Store Connect](https://appstoreconnect.apple.com)
- [ ] Team ID: `5D9V25DXPB`
- [ ] Apple ID: `sosnipez@yahoo.com`

### 2. App Store Connect Setup
- [ ] Create new app in App Store Connect
- [ ] Bundle ID: `com.lanonasis.subpro`
- [ ] Get ASC App ID (update in `eas.json` line 117)
- [ ] Set app category: Finance / Utilities
- [ ] Set age rating (likely 4+)

### 3. Disable Demo Mode (Critical!)
Run the toggle script before building:
```bash
./scripts/toggle-demo-mode.sh disable
```

This will:
- Set `DEMO_MODE_ENABLED = false` in AuthContext
- Require real Supabase authentication
- Hide guest login buttons

### 4. Supabase Configuration
- [ ] Verify Supabase project is operational
- [ ] Test authentication flow works
- [ ] Confirm database tables are migrated
- [ ] Set production environment variables in EAS

### 5. EAS Secrets Setup
Run these commands to set production secrets:
```bash
# Supabase
eas secret:create --name SUPABASE_PRODUCTION_URL --value "https://your-project.supabase.co"
eas secret:create --name SUPABASE_PRODUCTION_ANON_KEY --value "your-anon-key"

# Stripe (if using payments)
eas secret:create --name STRIPE_LIVE_PUBLISHABLE_KEY --value "pk_live_..."

# AdMob (if using ads)
eas secret:create --name ADMOB_LIVE_APP_ID --value "ca-app-pub-..."
eas secret:create --name ADMOB_LIVE_BANNER_ID --value "ca-app-pub-..."
```

---

## App Store Metadata

### Required Information
- [ ] App Name: SubTrack Pro
- [ ] Subtitle: Smart Subscription Manager
- [ ] Description (up to 4000 chars)
- [ ] Keywords (100 chars max, comma-separated)
- [ ] Support URL
- [ ] Privacy Policy URL
- [ ] Marketing URL (optional)

### Screenshots Required
| Device | Size | Required |
|--------|------|----------|
| iPhone 6.7" | 1290 x 2796 | Yes |
| iPhone 6.5" | 1242 x 2688 | Yes |
| iPhone 5.5" | 1242 x 2208 | Yes |
| iPad Pro 12.9" | 2048 x 2732 | If tablet support |

### App Preview Video (Optional)
- 15-30 seconds
- No device frames
- Show key features

---

## Build & Submit

### Step 1: Login to EAS
```bash
npx eas-cli login
```

### Step 2: Build for App Store
```bash
npx eas-cli build --platform ios --profile store-submission
```

### Step 3: Submit to App Store
```bash
npx eas-cli submit --platform ios --profile store-submission
```

### Step 4: Complete App Store Connect
1. Go to App Store Connect
2. Select your app
3. Fill in metadata (description, screenshots)
4. Answer export compliance questions
5. Submit for review

---

## Post-Submission

### Review Timeline
- Typical review: 24-48 hours
- First submission: May take longer
- Rejections: Address feedback promptly

### Common Rejection Reasons
1. **Demo/placeholder content** - Ensure all features work
2. **Login issues** - Auth must work flawlessly
3. **Incomplete metadata** - Fill all required fields
4. **Privacy violations** - Accurate privacy labels

### After Approval
- [ ] Monitor crash reports
- [ ] Respond to user reviews
- [ ] Plan update cadence
- [ ] Set up TestFlight for beta testing

---

## Quick Reference

| Item | Value |
|------|-------|
| Bundle ID | `com.lanonasis.subpro` |
| Team ID | `5D9V25DXPB` |
| EAS Project ID | `c026aca9-e212-434f-bb68-65603b900112` |
| Build Profile | `store-submission` |
| Demo Mode Script | `./scripts/toggle-demo-mode.sh` |

---

## Support

For issues with:
- **EAS builds**: [expo.dev/eas](https://expo.dev/eas)
- **App Store Connect**: [developer.apple.com/help](https://developer.apple.com/help)
- **Supabase**: [supabase.com/docs](https://supabase.com/docs)
