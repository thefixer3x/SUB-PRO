#!/bin/bash

# Build and Submit Script for SubTrack Pro
# Usage: ./scripts/build-and-submit.sh [ios|android|all]

set -e

PLATFORM=${1:-all}
PROFILE=${2:-production}

echo "🚀 Starting build and submit process for $PLATFORM platform(s) with $PROFILE profile..."

if [ "$PLATFORM" = "ios" ] || [ "$PLATFORM" = "all" ]; then
    echo "📱 Building iOS app..."
    eas build --platform ios --profile $PROFILE --non-interactive
    
    if [ $? -eq 0 ]; then
        echo "✅ iOS build successful! Submitting to App Store..."
        eas submit --platform ios --profile $PROFILE --non-interactive
        
        if [ $? -eq 0 ]; then
            echo "✅ iOS submission successful!"
        else
            echo "❌ iOS submission failed!"
            exit 1
        fi
    else
        echo "❌ iOS build failed!"
        exit 1
    fi
fi

if [ "$PLATFORM" = "android" ] || [ "$PLATFORM" = "all" ]; then
    echo "🤖 Building Android app..."
    eas build --platform android --profile $PROFILE --non-interactive
    
    if [ $? -eq 0 ]; then
        echo "✅ Android build successful! Submitting to Play Store..."
        eas submit --platform android --profile $PROFILE --non-interactive
        
        if [ $? -eq 0 ]; then
            echo "✅ Android submission successful!"
        else
            echo "❌ Android submission failed!"
            exit 1
        fi
    else
        echo "❌ Android build failed!"
        exit 1
    fi
fi

echo "🎉 All builds and submissions completed successfully!"
