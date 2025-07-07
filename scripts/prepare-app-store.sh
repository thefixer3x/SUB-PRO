#!/bin/bash

# 🎨 SubTrack Pro - App Store Asset Generation Script
# This script creates the required image assets for App Store and Play Store submission

echo "🎨 Generating App Store Assets for SubTrack Pro"
echo "=============================================="

# Create assets directory structure
mkdir -p assets/images/store
mkdir -p assets/images/screenshots/ios
mkdir -p assets/images/screenshots/android

# Create adaptive icon for Android (if it doesn't exist)
if [ ! -f "assets/images/adaptive-icon.png" ]; then
    cp assets/images/icon.png assets/images/adaptive-icon.png
    echo "✅ Created adaptive-icon.png from icon.png"
fi

# Create splash screen (if it doesn't exist)
if [ ! -f "assets/images/splash.png" ]; then
    cp assets/images/icon.png assets/images/splash.png
    echo "✅ Created splash.png from icon.png"
fi

# Create notification icon (if it doesn't exist)
if [ ! -f "assets/images/notification-icon.png" ]; then
    cp assets/images/icon.png assets/images/notification-icon.png
    echo "✅ Created notification-icon.png from icon.png"
fi

echo ""
echo "📱 Required App Store Assets:"
echo "============================"
echo ""
echo "🍎 iOS App Store:"
echo "- App Icon: 1024x1024 (assets/images/icon.png) ✅"
echo "- Screenshots: 6.7\", 6.5\", 5.5\", 12.9\" iPad"
echo "- App Preview Videos (optional)"
echo ""
echo "🤖 Google Play Store:"
echo "- App Icon: 512x512"
echo "- Feature Graphic: 1024x500"
echo "- Screenshots: Phone and Tablet"
echo "- Adaptive Icon: 512x512 (assets/images/adaptive-icon.png) ✅"
echo ""
echo "📋 Store Listing Information Needed:"
echo "===================================="
echo ""
echo "📝 App Description:"
echo "SubTrack Pro is the ultimate subscription management app that helps you track, manage, and optimize your recurring subscriptions. With AI-powered insights, virtual card management, and smart spending analytics, take control of your subscription finances like never before."
echo ""
echo "🔑 Key Features:"
echo "• Smart subscription tracking and categorization"
echo "• AI-powered spending insights and recommendations"
echo "• Virtual card management for secure online subscriptions"
echo "• Budget alerts and renewal notifications"
echo "• Shared subscription groups for families and teams"
echo "• Advanced analytics and spending trends"
echo "• Secure data encryption and privacy protection"
echo "• Cross-platform sync across all your devices"
echo ""
echo "🏷️ Keywords:"
echo "subscription manager, budget tracker, spending analytics, virtual cards, financial planning, money management, recurring payments, subscription tracker"
echo ""
echo "📂 Privacy Policy & Terms:"
echo "You'll need to create and host:"
echo "- Privacy Policy: https://subtrack-pro.com/privacy"
echo "- Terms of Service: https://subtrack-pro.com/terms"
echo "- Support URL: https://subtrack-pro.com/support"
echo ""
echo "🎯 App Categories:"
echo "iOS: Finance > Personal Finance"
echo "Android: Finance"
echo ""
echo "⚡ Next Steps for App Store Submission:"
echo "====================================="
echo "1. Create Apple Developer Account (\$99/year)"
echo "2. Create Google Play Developer Account (\$25 one-time)"
echo "3. Generate app icons and screenshots"
echo "4. Set up app store listings"
echo "5. Build with EAS: eas build --platform ios --profile store-submission"
echo "6. Build with EAS: eas build --platform android --profile store-submission"
echo "7. Submit for review"
echo ""
echo "🔧 EAS Build Commands Ready:"
echo "eas build --platform ios --profile store-submission"
echo "eas build --platform android --profile store-submission"
echo ""
echo "✅ App Store preparation complete!"
