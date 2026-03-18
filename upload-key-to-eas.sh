#!/bin/bash

# Upload Google service account key to EAS
set -e

echo "🔐 UPLOADING GOOGLE SERVICE ACCOUNT KEY TO EAS..."

cd /Users/seyederick/DevOps/_project_folders/seftechub-workspace/seftec-mobile-standalone

echo "📱 Project: SeftechHub Mobile"
echo "🔑 Key file: cohesive-mender-459104-c3-310879eaa6e5.json"
echo ""

# Upload the service account key as a secret
echo "📤 Uploading service account key to EAS..."
eas secret:create --scope project --name GOOGLE_SERVICES_KEY --type file --value ./cohesive-mender-459104-c3-310879eaa6e5.json

echo ""
echo "✅ Key uploaded successfully!"
echo ""

# List secrets to verify
echo "📋 Current EAS secrets:"
eas secret:list

echo ""
echo "🔄 Now you can submit without local key file:"
echo "eas submit --platform android --profile production --id 5b596108-ba84-4b2b-9398-2b90f8e51a33"
echo ""
echo "💡 The key will be securely retrieved from EAS during submission"