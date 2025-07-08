# SubTrack Pro - App Store & Play Store Submission Checklist

## ✅ Pre-Submission Checklist

### EAS Configuration
- [x] EAS CLI installed and authenticated
- [x] EAS project initialized (ID: c026aca9-e212-434f-bb68-65603b900112)
- [x] app.json configured with proper bundle identifiers
- [x] eas.json configured with build profiles
- [x] Environment variables properly configured for production

### App Configuration
- [x] App name: "SubTrack Pro"
- [x] Bundle identifier: com.thefixer3x.subtrackpro
- [x] Version: 1.0.0
- [x] Build number: 1 (iOS) / Version code: 1 (Android)
- [x] App icons (1024x1024, adaptive icon for Android)
- [x] Splash screen
- [x] App description and keywords

### Required Assets
- [x] App icon (icon.png - 1024x1024)
- [x] Adaptive icon (adaptive-icon.png - Android)
- [x] Splash screen (splash.png)
- [x] Notification icon (notification-icon.png)
- [ ] App Store screenshots (iPhone, iPad, Android Phone, Android Tablet)
- [ ] App preview videos (optional but recommended)

### Permissions & Privacy
- [x] Camera permission (document scanning)
- [x] Photo library permission (document selection)
- [x] Biometric authentication (Face ID/Touch ID)
- [x] Location permission (merchant insights)
- [x] User tracking permission (personalized ads)
- [ ] Privacy policy URL
- [ ] Terms of service URL
- [ ] Support URL

### Store Listings
- [ ] App Store Connect app creation
- [ ] Google Play Console app creation
- [ ] App descriptions (multiple languages if applicable)
- [ ] Keywords and categories
- [ ] Age rating questionnaire
- [ ] Content rating questionnaire

## 🚀 Build Commands

### iOS App Store Build
```bash
eas build --platform ios --profile store-submission
```

### Android Play Store Build
```bash
eas build --platform android --profile store-submission
```

### Check Build Status
```bash
eas build:list
```

## 📱 Submission Commands

### iOS App Store Submission
```bash
eas submit --platform ios --latest
```

### Android Play Store Submission
```bash
eas submit --platform android --latest
```

## 🔧 Environment Variables Required

### Production Environment Variables (Set in EAS Secrets)
- `STRIPE_LIVE_PUBLISHABLE_KEY`: Live Stripe publishable key
- `ADMOB_LIVE_APP_ID`: Live AdMob app ID
- `ADMOB_LIVE_BANNER_ID`: Live AdMob banner unit ID
- `ADMOB_LIVE_INTERSTITIAL_ID`: Live AdMob interstitial unit ID
- `ADMOB_LIVE_REWARDED_ID`: Live AdMob rewarded unit ID
- `SUPABASE_PRODUCTION_URL`: Production Supabase URL
- `SUPABASE_PRODUCTION_ANON_KEY`: Production Supabase anonymous key

### Setting EAS Secrets
```bash
eas secret:create --scope project --name STRIPE_LIVE_PUBLISHABLE_KEY --value pk_live_...
eas secret:create --scope project --name ADMOB_LIVE_APP_ID --value ca-app-pub-...
eas secret:create --scope project --name SUPABASE_PRODUCTION_URL --value https://...
```

## 📋 App Store Connect Configuration

### App Information
- App Name: SubTrack Pro
- Subtitle: Smart Subscription Manager
- Category: Finance
- Content Rights: Does not contain third-party content
- Age Rating: 4+ (Low Maturity)

### Privacy Information
- Data Collection: Yes (for analytics and personalized ads)
- Data Usage: Account management, app functionality, analytics
- Data Sharing: With advertising partners (anonymized)

### App Features
- In-App Purchases: Subscription plans (Basic, Pro, Enterprise)
- Advertising: Yes (AdMob integration)
- Age Rating: 4+ (Finance app, no objectionable content)

## 🤖 Google Play Console Configuration

### Store Listing
- App Name: SubTrack Pro
- Short Description: Smart subscription management with AI insights
- Full Description: Comprehensive subscription tracking with virtual cards
- Category: Finance
- Content Rating: Everyone

### App Content
- Target Audience: Adults (financial management)
- Content Rating: Everyone (IARC)
- Ads: Contains ads
- In-app Products: Subscription plans

## ✅ Final Checks Before Submission

### Functionality Testing
- [ ] App launches without crashes
- [ ] All core features work (subscription tracking, analytics, payments)
- [ ] Stripe integration functional in production
- [ ] AdMob ads display correctly
- [ ] User authentication works
- [ ] Data persistence works correctly
- [ ] Deep linking works
- [ ] Notifications work
- [ ] All permissions work as expected

### Performance Testing
- [ ] App loads within 3 seconds
- [ ] Smooth navigation between screens
- [ ] No memory leaks
- [ ] Battery usage optimized
- [ ] Network usage optimized

### Store Compliance
- [ ] Privacy policy accessible in app
- [ ] Terms of service accessible in app
- [ ] Support contact information provided
- [ ] Age-appropriate content
- [ ] No prohibited content
- [ ] Proper use of platform APIs

## 🔍 Common Rejection Reasons to Avoid

### iOS App Store
- Missing privacy policy
- Improper use of Apple Sign-In
- Misleading app descriptions
- Poor app performance
- Inadequate content moderation

### Google Play Store
- Violations of content policy
- Incomplete store listing
- Missing required permissions explanations
- Poor app quality
- Misleading metadata

## 📞 Support Information

### Required Support URLs
- Privacy Policy: https://subtrack-pro.lanonasis.com/privacy
- Terms of Service: https://subtrack-pro.lanonasis.com/terms
- Support Email: support@subtrack-pro.lanonasis.com
- Support URL: https://subtrack-pro.lanonasis.com/support

## 🎯 Next Steps After Approval

1. Monitor crash reports and user feedback
2. Prepare for iOS/Android version updates
3. Implement user-requested features
4. Optimize based on analytics data
5. Plan marketing and user acquisition strategies

---

**Note**: This checklist should be completed before submitting to both app stores. Keep this document updated as requirements change.
