#!/bin/bash

# Script to fix dependencies and submit SeftechHub Mobile to Google Play Store
set -e

echo "🚀 SUBMITTING SEFTECHUB MOBILE TO GOOGLE PLAY STORE..."

cd /Users/seyederick/DevOps/_project_folders/seftechub-workspace/seftec-mobile-standalone

echo "📱 Project: SeftechHub Mobile"
echo "📍 Directory: $(pwd)"
echo ""

# Step 1: Fix dependency issues
echo "🔧 Step 1: Fixing Expo dependencies..."
echo "Running: npx expo install --check"
npx expo install --check

echo ""
echo "✅ Dependencies updated successfully!"
echo ""

# Step 2: Verify project health
echo "🩺 Step 2: Running health check..."
npx expo doctor

echo ""
echo "✅ Project health check passed!"
echo ""

# Step 3: Submit to Google Play Store
echo "📦 Step 3: Submitting to Google Play Store..."
echo "Using most recent successful Android build: 5b596108-ba84-4b2b-9398-2b90f8e51a33"
echo ""

# Submit the latest successful build
eas submit --platform android --profile production --non-interactive

echo ""
echo "🎉 SUBMISSION COMPLETE!"
echo ""
echo "📋 NEXT STEPS:"
echo "1. Check Google Play Console for submission status"
echo "2. Review any feedback from Google Play review team"
echo "3. Monitor the app's review progress"
echo ""
echo "🔗 Google Play Console: https://play.google.com/console/"
echo "🔗 EAS Dashboard: https://expo.dev/accounts/thefixer3x/projects/seftechub-mobile"