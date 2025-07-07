#!/bin/bash

# SubTrack Pro - Manual Build Trigger
# Use this script to trigger builds locally or test the setup

echo "🚀 SubTrack Pro - Manual Build Trigger"
echo "======================================="

# Check if user wants to build locally or trigger GitHub Actions
echo "Choose build method:"
echo "1. Local EAS build (interactive)"
echo "2. Trigger GitHub Actions workflow"
echo "3. Check build status"
echo "4. Exit"
echo ""

read -p "Enter your choice (1-4): " choice

case $choice in
    1)
        echo "🏗️ Starting local EAS build..."
        echo "Available profiles: development, preview, production, store-submission"
        read -p "Enter build profile (default: development): " profile
        profile=${profile:-development}
        
        read -p "Enter platform (android/ios/all, default: all): " platform
        platform=${platform:-all}
        
        echo "Starting build with profile: $profile, platform: $platform"
        
        if [ "$platform" = "all" ]; then
            echo "Building for Android..."
            eas build --platform android --profile $profile
            echo "Building for iOS..."
            eas build --platform ios --profile $profile
        else
            eas build --platform $platform --profile $profile
        fi
        ;;
    
    2)
        echo "🔗 Triggering GitHub Actions workflow..."
        echo "This will trigger the workflow manually."
        echo "Make sure you have GitHub CLI installed and authenticated."
        
        read -p "Enter build profile (default: production): " profile
        profile=${profile:-production}
        
        read -p "Enter platform (android/ios/all, default: all): " platform
        platform=${platform:-all}
        
        read -p "Skip tests? (true/false, default: false): " skip_tests
        skip_tests=${skip_tests:-false}
        
        echo "Triggering workflow with:"
        echo "- Profile: $profile"
        echo "- Platform: $platform"
        echo "- Skip tests: $skip_tests"
        
        gh workflow run "EAS Build and Deploy" \
            -f platform="$platform" \
            -f profile="$profile" \
            -f skip_tests="$skip_tests"
        
        if [ $? -eq 0 ]; then
            echo "✅ Workflow triggered successfully!"
            echo "Check status at: https://github.com/thefixer3x/SUB-PRO/actions"
        else
            echo "❌ Failed to trigger workflow. Make sure GitHub CLI is installed and authenticated."
            echo "Install: brew install gh"
            echo "Login: gh auth login"
        fi
        ;;
    
    3)
        echo "📊 Checking build status..."
        echo ""
        echo "Recent EAS builds:"
        eas build:list --limit 5
        echo ""
        echo "Recent GitHub Actions runs:"
        if command -v gh &> /dev/null; then
            gh run list --limit 5
        else
            echo "GitHub CLI not installed. Check manually at:"
            echo "https://github.com/thefixer3x/SUB-PRO/actions"
        fi
        ;;
    
    4)
        echo "👋 Goodbye!"
        exit 0
        ;;
    
    *)
        echo "❌ Invalid choice. Please run the script again."
        exit 1
        ;;
esac

echo ""
echo "🔗 Useful links:"
echo "- EAS Dashboard: https://expo.dev/accounts/thefixer3x/projects/subtrack-pro"
echo "- GitHub Actions: https://github.com/thefixer3x/SUB-PRO/actions"
echo "- App Store Connect: https://appstoreconnect.apple.com"
echo "- Google Play Console: https://play.google.com/console"
