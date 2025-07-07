#!/bin/bash

# SubTrack Pro - EAS Secrets Setup
# Run this script to set up production environment variables

echo "🔐 Setting up EAS production secrets for SubTrack Pro"
echo "====================================================="

echo "⚠️  You'll need the following production credentials:"
echo "- Live Stripe Publishable Key"
echo "- Live AdMob App IDs and Unit IDs"
echo "- Production Supabase URL and Anon Key"
echo ""

read -p "Do you want to continue? (y/N): " confirm
if [[ $confirm != [yY] ]]; then
    echo "Setup cancelled."
    exit 0
fi

# Function to set secret
set_secret() {
    local name=$1
    local description=$2
    
    echo ""
    echo "Setting up: $description"
    read -p "Enter $name: " value
    
    if [[ -n "$value" ]]; then
        eas secret:create --scope project --name "$name" --value "$value" --force
        echo "✅ $name set successfully"
    else
        echo "❌ Skipping $name (empty value)"
    fi
}

echo ""
echo "🎯 Setting up production secrets..."

# Stripe secrets
set_secret "STRIPE_LIVE_PUBLISHABLE_KEY" "Live Stripe Publishable Key (pk_live_...)"

# AdMob secrets
set_secret "ADMOB_LIVE_APP_ID" "Live AdMob App ID"
set_secret "ADMOB_LIVE_BANNER_ID" "Live AdMob Banner Unit ID"
set_secret "ADMOB_LIVE_INTERSTITIAL_ID" "Live AdMob Interstitial Unit ID"
set_secret "ADMOB_LIVE_REWARDED_ID" "Live AdMob Rewarded Unit ID"

# Supabase secrets
set_secret "SUPABASE_PRODUCTION_URL" "Production Supabase URL"
set_secret "SUPABASE_PRODUCTION_ANON_KEY" "Production Supabase Anonymous Key"

echo ""
echo "✅ Production secrets setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Run 'eas secret:list' to verify all secrets are set"
echo "2. Run the build script: './scripts/build-for-stores.sh'"
echo "3. Monitor builds at: https://expo.dev/accounts/thefixer3x/projects/subtrack-pro/builds"

echo ""
echo "🔗 Useful commands:"
echo "- List secrets: eas secret:list"
echo "- Delete secret: eas secret:delete --name SECRET_NAME"
echo "- Update secret: eas secret:create --name SECRET_NAME --value NEW_VALUE --force"
