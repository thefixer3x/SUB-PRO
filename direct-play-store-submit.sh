#!/bin/bash

# Direct submission to Google Play Store
set -e

echo "📦 SUBMITTING SEFTECHUB MOBILE TO GOOGLE PLAY STORE..."

cd /Users/seyederick/DevOps/_project_folders/seftechub-workspace/seftec-mobile-standalone

echo "📱 Project: SeftechHub Mobile"
echo "🎯 Using successful Android build: 5b596108-ba84-4b2b-9398-2b90f8e51a33"
echo ""

# Submit to Google Play Store
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