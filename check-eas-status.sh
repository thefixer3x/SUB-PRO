#!/bin/bash

# Script to check EAS build status for seftechub mobile
set -e

echo "🔍 CHECKING EAS BUILD STATUS FOR SEFTECHUB MOBILE..."

cd /Users/seyederick/DevOps/_project_folders/seftechub-workspace/seftec-mobile-standalone

echo "📱 Project: SeftechHub Mobile"
echo "📍 Directory: $(pwd)"
echo ""

# Check if EAS is authenticated
echo "🔐 Checking EAS authentication..."
eas whoami

echo ""
echo "🏗️  Recent Android builds:"
eas build:list --platform android --limit 5

echo ""
echo "🍎 Recent iOS builds:"
eas build:list --platform ios --limit 5

echo ""
echo "📋 Overall build status:"
eas build:list --limit 10

echo ""
echo "🎯 Project info:"
eas project:info