#!/bin/bash

# SubTrack Pro - EAS Credentials & Build Setup Script
# This script helps set up credentials and build the app for store submission

set -e

echo "🚀 SubTrack Pro - App Store Submission Setup"
echo "============================================="

# Check if EAS CLI is installed
if ! command -v eas &> /dev/null; then
    echo "❌ EAS CLI is not installed. Installing now..."
    npm install -g eas-cli
fi

# Check if user is logged in
echo "📋 Checking EAS authentication..."
if ! eas whoami &> /dev/null; then
    echo "❌ Not logged in to EAS. Please log in:"
    eas login
fi

echo "✅ EAS authentication confirmed"

# Set up iOS credentials
echo "📱 Setting up iOS credentials..."
echo "This will guide you through setting up iOS distribution certificates and provisioning profiles."
echo "You'll need:"
echo "- Apple Developer account"
echo "- App Store Connect access"
read -p "Press Enter to continue with iOS credential setup..."

eas credentials -p ios

# Set up Android credentials
echo "🤖 Setting up Android credentials..."
echo "This will guide you through setting up Android keystore for Play Store."
read -p "Press Enter to continue with Android credential setup..."

eas credentials -p android

# Set up environment variables
echo "🔐 Setting up production environment variables..."
echo "You'll need to provide the following production values:"

echo "Setting up Stripe environment variables..."
read -p "Enter your LIVE Stripe Publishable Key (pk_live_...): " STRIPE_LIVE_KEY
eas secret:create --scope project --name STRIPE_LIVE_PUBLISHABLE_KEY --value "$STRIPE_LIVE_KEY"

read -p "Enter your LIVE AdMob App ID: " ADMOB_APP_ID
eas secret:create --scope project --name ADMOB_LIVE_APP_ID --value "$ADMOB_APP_ID"

read -p "Enter your LIVE AdMob Banner ID: " ADMOB_BANNER_ID
eas secret:create --scope project --name ADMOB_LIVE_BANNER_ID --value "$ADMOB_BANNER_ID"

read -p "Enter your LIVE AdMob Interstitial ID: " ADMOB_INTERSTITIAL_ID
eas secret:create --scope project --name ADMOB_LIVE_INTERSTITIAL_ID --value "$ADMOB_INTERSTITIAL_ID"

read -p "Enter your LIVE AdMob Rewarded ID: " ADMOB_REWARDED_ID
eas secret:create --scope project --name ADMOB_LIVE_REWARDED_ID --value "$ADMOB_REWARDED_ID"

read -p "Enter your production Supabase URL: " SUPABASE_URL
eas secret:create --scope project --name SUPABASE_PRODUCTION_URL --value "$SUPABASE_URL"

read -p "Enter your production Supabase Anon Key: " SUPABASE_KEY
eas secret:create --scope project --name SUPABASE_PRODUCTION_ANON_KEY --value "$SUPABASE_KEY"

echo "✅ All environment variables set up successfully!"

# Build for both platforms
echo "🏗️ Building apps for store submission..."

echo "Building iOS app for App Store..."
eas build --platform ios --profile store-submission

echo "Building Android app for Play Store..."
eas build --platform android --profile store-submission

echo "✅ Build setup complete!"
echo "📋 Next steps:"
echo "1. Wait for builds to complete (check status with 'eas build:list')"
echo "2. Download the builds from EAS dashboard"
echo "3. Upload iOS .ipa to App Store Connect"
echo "4. Upload Android .aab to Google Play Console"
echo "5. Fill out store listings and submit for review"

echo "🔗 Useful links:"
echo "- EAS Dashboard: https://expo.dev/accounts/thefixer3x/projects/subtrack-pro"
echo "- App Store Connect: https://appstoreconnect.apple.com"
echo "- Google Play Console: https://play.google.com/console"
