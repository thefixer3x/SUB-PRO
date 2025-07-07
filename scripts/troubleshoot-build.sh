#!/bin/bash

# SubTrack Pro - Build Troubleshooting Script
# This script helps diagnose and fix common EAS build issues

echo "🔧 SubTrack Pro - Build Troubleshooting"
echo "======================================="

# Check EAS CLI version
echo "📋 EAS CLI Version:"
eas --version

# Check project authentication
echo ""
echo "🔐 EAS Authentication:"
eas whoami

# Check project info
echo ""
echo "📱 Project Information:"
eas project:info

# Check recent build status
echo ""
echo "📊 Recent Build Status:"
eas build:list --limit 5

# Validate app configuration
echo ""
echo "🔍 Configuration Validation:"
echo "Checking app.json configuration..."
npx expo config --type introspect > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ App configuration is valid"
else
    echo "❌ App configuration has issues"
    echo "Running detailed check..."
    npx expo config --type introspect
fi

# Check for TypeScript errors
echo ""
echo "🧪 TypeScript Check:"
npm run type-check
if [ $? -eq 0 ]; then
    echo "✅ No TypeScript errors"
else
    echo "❌ TypeScript errors found - these may cause build failures"
fi

# Check dependencies
echo ""
echo "📦 Dependency Check:"
npx expo install --check
if [ $? -eq 0 ]; then
    echo "✅ Dependencies are compatible"
else
    echo "⚠️  Dependency issues found"
fi

# Check for common build issues
echo ""
echo "🚨 Common Build Issue Checks:"

# Check for missing assets
if [ ! -f "assets/images/icon.png" ]; then
    echo "❌ Missing app icon"
else
    echo "✅ App icon exists"
fi

if [ ! -f "assets/images/splash.png" ]; then
    echo "❌ Missing splash screen"
else
    echo "✅ Splash screen exists"
fi

# Check for environment variables
if [ -f ".env" ]; then
    echo "✅ Environment file exists"
    echo "📋 Environment variables loaded:"
    grep -E "^EXPO_PUBLIC_|^STRIPE_|^ADMOB_" .env | head -10
else
    echo "⚠️  No .env file found"
fi

# Test build command (dry run)
echo ""
echo "🧪 Build Command Test:"
echo "Testing build command syntax..."
eas build --platform android --profile preview --non-interactive --dry-run
if [ $? -eq 0 ]; then
    echo "✅ Build command syntax is valid"
else
    echo "❌ Build command has issues"
fi

echo ""
echo "🔧 Build Troubleshooting Complete"
echo "=================================="
echo ""
echo "🚀 Next Steps:"
echo "1. Fix any issues identified above"
echo "2. Try a preview build first: eas build --platform android --profile preview"
echo "3. Check build logs at: https://expo.dev/accounts/thefixer3x/projects/subtrack-pro/builds"
echo "4. If issues persist, try: eas build --platform android --profile development"
echo ""
echo "📋 Common Solutions:"
echo "- Update dependencies: npx expo install --fix"
echo "- Clear cache: eas build --clear-cache"
echo "- Check AdMob configuration in app.json"
echo "- Verify all required assets exist"
echo "- Check EAS secrets: eas secret:list"
