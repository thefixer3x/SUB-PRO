#!/bin/bash

# OTA Update Script for SubTrack Pro
# Usage: ./scripts/ota-update.sh "Your update message"

set -e

MESSAGE=${1:-"Banking app update"}
BRANCH=${2:-main}

echo "🚀 Publishing OTA update..."
echo "📝 Message: $MESSAGE"
echo "🌿 Branch: $BRANCH"

eas update --branch $BRANCH --message "$MESSAGE"

if [ $? -eq 0 ]; then
    echo "✅ OTA update published successfully!"
    echo "📱 Users will receive the update automatically"
else
    echo "❌ OTA update failed!"
    exit 1
fi
