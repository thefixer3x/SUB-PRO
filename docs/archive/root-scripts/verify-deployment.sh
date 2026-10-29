#!/bin/bash

# 🚀 SubTrack Pro - Deployment Verification Script
# Date: July 7, 2025

echo "🎯 SubTrack Pro Deployment Verification"
echo "========================================"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the project root."
    exit 1
fi

echo "📋 Running pre-deployment checks..."

# 1. TypeScript Check
echo "1. TypeScript compilation..."
if npm run type-check > /dev/null 2>&1; then
    echo "   ✅ TypeScript: PASSED"
else
    echo "   ❌ TypeScript: FAILED"
    echo "   Please fix TypeScript errors before deployment"
    exit 1
fi

# 2. Build Test
echo "2. Production build test..."
if npm run build:production > /dev/null 2>&1; then
    echo "   ✅ Build: SUCCESSFUL"
    
    # Check if dist directory exists and has content
    if [ -d "dist" ] && [ "$(ls -A dist)" ]; then
        echo "   ✅ Dist folder: Created with content"
    else
        echo "   ❌ Dist folder: Empty or missing"
        exit 1
    fi
else
    echo "   ❌ Build: FAILED"
    echo "   Please fix build errors before deployment"
    exit 1
fi

# 3. Check Environment Variables
echo "3. Environment configuration..."
if [ -f ".env" ]; then
    echo "   ✅ .env file: Present"
    
    # Check for required variables
    required_vars=("EXPO_PUBLIC_SUPABASE_URL" "EXPO_PUBLIC_SUPABASE_ANON_KEY" "EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY")
    for var in "${required_vars[@]}"; do
        if grep -q "^$var=" .env; then
            echo "   ✅ $var: Configured"
        else
            echo "   ⚠️ $var: Missing (may need configuration)"
        fi
    done
else
    echo "   ⚠️ .env file: Missing (using defaults)"
fi

# 4. Check for common issues
echo "4. Common deployment issues..."

# Check for hardcoded localhost URLs
if grep -r "localhost" dist/ > /dev/null 2>&1; then
    echo "   ⚠️ Warning: localhost URLs found in build"
else
    echo "   ✅ No localhost URLs in build"
fi

# Check bundle size
if [ -f "dist/_expo/static/js/web/entry-"*".js" ]; then
    bundle_size=$(du -h dist/_expo/static/js/web/entry-*.js | cut -f1)
    echo "   📦 Bundle size: $bundle_size"
    
    # Warn if bundle is very large (>5MB)
    size_bytes=$(du -b dist/_expo/static/js/web/entry-*.js | cut -f1)
    if [ "$size_bytes" -gt 5242880 ]; then
        echo "   ⚠️ Warning: Large bundle size may affect loading"
    fi
else
    echo "   ⚠️ Warning: Bundle file not found"
fi

echo ""
echo "🎯 Deployment Readiness Summary"
echo "==============================="
echo "✅ TypeScript compilation: PASSED"
echo "✅ Production build: SUCCESSFUL" 
echo "✅ No blocking issues found"
echo ""
echo "🚀 Ready for deployment!"
echo ""
echo "📋 Next Steps:"
echo "1. Deploy the 'dist/' folder to your hosting platform"
echo "2. Configure environment variables on your hosting platform"
echo "3. Set up custom domain (optional)"
echo "4. Test the live deployment"
echo ""
echo "🔗 Recommended Hosting Platforms:"
echo "- Vercel: vercel.com"
echo "- Netlify: netlify.com" 
echo "- GitHub Pages: pages.github.com"
echo "- Firebase Hosting: firebase.google.com/docs/hosting"
echo ""
echo "✅ Verification Complete - $(date)"
