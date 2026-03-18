#!/bin/bash

# Build new Android .aab file with updated version
set -e

echo "🏗️  BUILDING NEW ANDROID AAB FILE..."

cd /Users/seyederick/DevOps/_project_folders/seftechub-workspace/seftec-mobile-standalone

echo "📱 Project: SeftechHub Mobile"
echo "📋 Version: 1.1.3 (Version code: 2)"
echo ""

# Build Android AAB
eas build --platform android --profile production --clear-cache

echo ""
echo "✅ BUILD STARTED!"
echo "📍 Monitor build progress at: https://expo.dev/accounts/thefixer3x/projects/seftechub-mobile"
echo ""
echo "📦 Once complete, the .aab file will be available for download"