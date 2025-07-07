# GitHub Secrets for AdMob Configuration

Add these secrets to your GitHub repository for the EAS build process:

## Required Secrets

### App IDs (Platform-specific)
```
ADMOB_IOS_APP_ID=ca-app-pub-7459389089200506~3544672881
ADMOB_ANDROID_APP_ID=ca-app-pub-7459389089200506~3035173479
```

### Ad Unit IDs (Shared across platforms for simplicity)
```
ADMOB_BANNER_IOS_ID=ca-app-pub-7459389089200506/8195198481
ADMOB_BANNER_ANDROID_ID=ca-app-pub-7459389089200506/4383397244
ADMOB_INTERSTITIAL_IOS_ID=ca-app-pub-7459389089200506/6726204143
ADMOB_INTERSTITIAL_ANDROID_ID=ca-app-pub-7459389089200506/3081923869
ADMOB_REWARDED_IOS_ID=ca-app-pub-7459389089200506/6943463042
ADMOB_REWARDED_ANDROID_ID=ca-app-pub-7459389089200506/9305902501
```

## How to Add These Secrets

1. Go to your GitHub repository: https://github.com/thefixer3x/SUB-PRO
2. Click on "Settings" tab
3. In the left sidebar, click "Secrets and variables" → "Actions"
4. Click "New repository secret"
5. Add each secret with the name and value as shown above

## Alternative: Simplified Configuration

If you want to use the same ad units for both platforms (not recommended for production):
```
ADMOB_LIVE_APP_ID=ca-app-pub-7459389089200506~3035173479
ADMOB_LIVE_BANNER_ID=ca-app-pub-7459389089200506/4383397244
ADMOB_LIVE_INTERSTITIAL_ID=ca-app-pub-7459389089200506/3081923869
ADMOB_LIVE_REWARDED_ID=ca-app-pub-7459389089200506/9305902501
```

Note: The app.json file has already been updated with the correct App IDs for the react-native-google-mobile-ads plugin.