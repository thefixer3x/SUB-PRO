#!/bin/bash

# Submit SeftechHub Mobile to Google Play Store using EAS-stored key
set -e

echo "📦 SUBMITTING SEFTECHUB MOBILE TO GOOGLE PLAY STORE..."
echo "🔐 Using EAS-stored Google service account key"

cd /Users/seyederick/DevOps/_project_folders/seftechub-workspace/seftec-mobile-standalone

echo "📱 Project: SeftechHub Mobile"
echo "🎯 Build ID: 5b596108-ba84-4b2b-9398-2b90f8e51a33"
echo "🔑 Key: GOOGLE_SERVICES_KEY (stored in EAS)"
echo ""

# Submit using EAS-stored credentials
eas submit --platform android --profile production --id 5b596108-ba84-4b2b-9398-2b90f8e51a33

echo ""
echo "🎉 SUBMISSION PROCESS COMPLETE!"