#!/bin/bash

# SubTrack Pro - Simple Store Build Script
# Run this script to build apps for store submission

set -e

echo "🚀 SubTrack Pro - Building for App Stores"
echo "==========================================="

# Check project status
echo "📋 Checking project status..."
eas project:info

# List existing builds
echo "📜 Previous builds:"
eas build:list --limit 5

# Build iOS for App Store
echo "📱 Building iOS app for App Store submission..."
echo "This will use interactive mode to set up credentials if needed."
eas build --platform ios --profile store-submission

# Build Android for Play Store  
echo "🤖 Building Android app for Play Store submission..."
echo "This will use interactive mode to set up credentials if needed."
eas build --platform android --profile store-submission

echo "✅ Build commands executed!"
echo "📋 Monitor build progress:"
echo "- Run 'eas build:list' to check status"
echo "- Visit https://expo.dev/accounts/thefixer3x/projects/subtrack-pro/builds"

echo "📱 After builds complete:"
echo "- Download .ipa for iOS App Store Connect"
echo "- Download .aab for Google Play Console"
