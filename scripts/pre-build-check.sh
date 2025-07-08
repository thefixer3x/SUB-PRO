#!/bin/bash

# Pre-build validation script to avoid costly EAS build failures
# Run this locally before pushing changes or triggering EAS builds

set -e

echo "🔍 Pre-Build Validation Script"
echo "This helps avoid costly EAS build failures"
echo "========================================"

# Check if we're in the right directory
if [[ ! -f "app.json" ]]; then
    echo "❌ Error: app.json not found. Please run from project root."
    exit 1
fi

echo "✅ Project structure validated"

# Install dependencies if needed
if [[ ! -d "node_modules" ]]; then
    echo "📦 Installing dependencies..."
    npm ci
fi

echo "✅ Dependencies ready"

# TypeScript check
echo "🔍 Running TypeScript check..."
npm run type-check || {
    echo "❌ TypeScript errors found. Fix before building."
    exit 1
}
echo "✅ TypeScript check passed"

# Lint check  
echo "🔍 Running lint check..."
npm run lint || {
    echo "⚠️  Lint issues found but continuing (can be fixed later)"
    echo "Consider fixing linting issues for better code quality"
}
echo "✅ Lint check completed"

# Test Metro bundling for both platforms
echo "🧪 Testing Metro bundling..."

# Android bundle test
echo "Testing Android bundle..."
npx expo export --platform android --dev --output-dir ./test-android-bundle || {
    echo "❌ Android bundling failed!"
    echo "This would cause an expensive EAS build failure."
    exit 1
}
echo "✅ Android bundle test passed"

# iOS bundle test
echo "Testing iOS bundle..."
npx expo export --platform ios --dev --output-dir ./test-ios-bundle || {
    echo "❌ iOS bundling failed!"
    echo "This would cause an expensive EAS build failure."
    rm -rf test-android-bundle
    exit 1
}
echo "✅ iOS bundle test passed"

# Cleanup test bundles
rm -rf test-android-bundle test-ios-bundle

# Validate app config
echo "🔧 Validating app configuration..."
npx expo config --type public > /dev/null || {
    echo "❌ App configuration invalid"
    exit 1
}
echo "✅ App configuration valid"

# Check bundle identifiers
echo "🔍 Checking bundle identifiers..."
BUNDLE_ID=$(node -p "require('./app.json').expo.ios.bundleIdentifier")
PACKAGE_NAME=$(node -p "require('./app.json').expo.android.package")

if [[ "$BUNDLE_ID" != "com.lanonasis.subpro" ]]; then
    echo "❌ iOS bundle ID mismatch: $BUNDLE_ID"
    echo "Expected: com.lanonasis.subpro"
    exit 1
fi

if [[ "$PACKAGE_NAME" != "com.lanonasis.subpro" ]]; then
    echo "❌ Android package name mismatch: $PACKAGE_NAME"
    echo "Expected: com.lanonasis.subpro"
    exit 1
fi

echo "✅ Bundle identifiers correct"

echo ""
echo "🎉 All pre-build checks passed!"
echo "✅ Safe to trigger EAS build"
echo ""
echo "To trigger build:"
echo "  gh workflow run enhanced-eas-build.yml -f platform=all -f profile=production"
echo ""
echo "Or for single platform:"
echo "  gh workflow run enhanced-eas-build.yml -f platform=android -f profile=production"
echo "  gh workflow run enhanced-eas-build.yml -f platform=ios -f profile=production"