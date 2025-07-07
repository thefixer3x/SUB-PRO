#!/bin/bash

# EAS Secrets Configuration for AdMob and AdSense
# Run this script to set up your ad monetization environment variables in EAS

echo "Setting up AdMob and AdSense secrets for EAS build..."

# Set AdMob App ID (used by the native SDKs)
echo "Setting ADMOB_APP_ID..."
eas secret:create --scope project --name ADMOB_APP_ID --value "ca-app-pub-xxxxxxxxxxxxxxxx~xxxxxxxxxx"

# Set AdMob Ad Unit IDs (used by the app code)
echo "Setting AdMob ad unit IDs..."
eas secret:create --scope project --name ADMOB_BANNER_ID --value "ca-app-pub-xxxxxxxxxxxxxxxx/xxxxxxxxxx"
eas secret:create --scope project --name ADMOB_INTERSTITIAL_ID --value "ca-app-pub-xxxxxxxxxxxxxxxx/xxxxxxxxxx"
eas secret:create --scope project --name ADMOB_REWARDED_ID --value "ca-app-pub-xxxxxxxxxxxxxxxx/xxxxxxxxxx"

# Set AdSense Publisher ID
echo "Setting AdSense publisher ID..."
eas secret:create --scope project --name ADSENSE_PUBLISHER_ID --value "pub-xxxxxxxxxxxxxxxx"
eas secret:create --scope project --name ADSENSE_SLOT_ID --value "xxxxxxxxxx"

# Set feature flags
echo "Setting feature flags..."
eas secret:create --scope project --name MONETIZATION_V1 --value "true"
eas secret:create --scope project --name EMBED_FINANCE_BETA --value "true"
eas secret:create --scope project --name COMPLIANCE_CENTER --value "true"

echo "✅ All secrets have been configured!"
echo ""
echo "Next steps:"
echo "1. Replace the placeholder values with your actual AdMob and AdSense IDs"
echo "2. Update app.json with your actual AdMob App ID"
echo "3. Test ads in development using test ad units"
echo "4. Build and deploy using: eas build --platform all"
echo ""
echo "Test Ad Units (for development):"
echo "Banner: ca-app-pub-3940256099942544/6300978111"
echo "Interstitial: ca-app-pub-3940256099942544/1033173712"
echo "Rewarded: ca-app-pub-3940256099942544/5224354917"
