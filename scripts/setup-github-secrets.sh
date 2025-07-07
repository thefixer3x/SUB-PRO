#!/bin/bash

# GitHub Secrets Setup for SubTrack Pro
# This script helps set up required GitHub secrets for the workflow

echo "🔐 GitHub Secrets Setup for SubTrack Pro"
echo "========================================"

echo ""
echo "📋 Required GitHub Secrets for CI/CD:"
echo ""

echo "1. EXPO_TOKEN (Required)"
echo "   - Get from: https://expo.dev/accounts/settings/access-tokens"
echo "   - Description: Expo authentication token for EAS CLI"
echo ""

echo "2. Optional Production Secrets (for enhanced security):"
echo "   - STRIPE_LIVE_PUBLISHABLE_KEY"
echo "   - ADMOB_LIVE_APP_ID"  
echo "   - ADMOB_LIVE_BANNER_ID"
echo "   - ADMOB_LIVE_INTERSTITIAL_ID"
echo "   - ADMOB_LIVE_REWARDED_ID"
echo "   - SUPABASE_PRODUCTION_URL"
echo "   - SUPABASE_PRODUCTION_ANON_KEY"
echo ""

echo "🛠️ How to add secrets to GitHub:"
echo "1. Go to your repository: https://github.com/thefixer3x/SUB-PRO"
echo "2. Click 'Settings' tab"
echo "3. Click 'Secrets and variables' → 'Actions'"
echo "4. Click 'New repository secret'"
echo "5. Add each secret with its name and value"
echo ""

echo "🔍 Current GitHub Workflow Status:"
echo "- ✅ Workflow file exists: .github/workflows/eas-build.yml"
echo "- ✅ Enhanced workflow available: .github/workflows/enhanced-eas-build.yml"
echo "- ✅ Repository connected to GitHub"
echo "- ⚠️  EXPO_TOKEN secret needs to be configured"
echo ""

echo "🚀 Testing the workflow:"
echo "1. Configure EXPO_TOKEN secret in GitHub"
echo "2. Go to Actions tab in your repository"
echo "3. Select 'EAS Build and Deploy' workflow"
echo "4. Click 'Run workflow' → choose options → 'Run workflow'"
echo ""

echo "📊 Workflow Features:"
echo "- ✅ Automatic builds on push to main"
echo "- ✅ Manual builds with platform/profile selection"
echo "- ✅ Type checking and linting"
echo "- ✅ OTA updates for preview/production"
echo "- ✅ Build status monitoring"
echo ""

echo "🔗 Useful Links:"
echo "- GitHub Repository: https://github.com/thefixer3x/SUB-PRO"
echo "- Expo Dashboard: https://expo.dev/accounts/thefixer3x/projects/subtrack-pro"
echo "- EAS Build Docs: https://docs.expo.dev/build/introduction/"

echo ""
echo "✅ Your workflow is ready! Just add the EXPO_TOKEN secret to get started."
