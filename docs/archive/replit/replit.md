# SubTrack Pro

## Overview
SubTrack Pro is a comprehensive subscription management platform built with Expo/React Native for cross-platform support (iOS, Android, Web). It features AI-powered insights, virtual cards, and smart spending analytics to help users track and optimize their subscriptions.

## Project Architecture

### Tech Stack
- **Frontend Framework**: Expo SDK 54 with React Native 0.81
- **Web Bundler**: Metro bundler with React Native Web
- **Router**: Expo Router with file-based routing
- **State Management**: React Query (@tanstack/react-query)
- **Database/Auth**: Supabase (requires configuration)
- **Payments**: Stripe integration
- **Styling**: React Native StyleSheet with custom components

### Directory Structure
```
/app                 # Expo Router file-based routes
  /(auth)           # Authentication screens
  /(landing)        # Landing page components
  /(tabs)           # Main tabbed navigation screens
  /api              # API routes (server-only)
  /billing          # Billing related screens
/components         # Reusable UI components
/config             # App configuration files
/constants          # App-wide constants
/contexts           # React context providers
/services           # Business logic and API services
/utils              # Utility functions
/assets             # Images, fonts, and static assets
/scripts            # Build and deployment scripts
/docs               # Project documentation (organized)
  /app-store        # App Store submission guides
  /deployment       # Deployment & build guides
  /integration      # Third-party integration docs
  /architecture     # System design documentation
  /troubleshooting  # Debug & fix guides
  /archive          # Historical/completed docs
```

## Development

### Running Locally
```bash
npm install
npm run dev
```

This starts the Expo development server on port 5000 for web.

### Build Commands
- `npm run dev` - Start development server (web on port 5000)
- `npm run build:web` - Build for web production
- `npm run build:android` - Build Android app via EAS
- `npm run build:ios` - Build iOS app via EAS

## Environment Variables

The following environment variables are required for full functionality:

### Required
- `EXPO_PUBLIC_SUPABASE_URL` - Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key

### Optional
- `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Stripe publishable key
- `EXPO_PUBLIC_ADMOB_*` - AdMob configuration (for mobile ads)

## Deployment

### Web Deployment
The project is configured to deploy as an autoscale app on Replit:
1. Build: `npm run build:web` - Creates production bundle in `/dist`
2. Run: `npx serve dist -l 5000` - Serves the static build

### Mobile Deployment
Uses EAS (Expo Application Services) for iOS and Android builds.

## User Preferences
- Project uses TypeScript throughout
- Follows Expo and React Native best practices
- Uses file-based routing via Expo Router

## Demo Mode

The app has a temporary demo mode for development/testing when Supabase is unavailable.

### Toggle Demo Mode
```bash
# Check status
./scripts/toggle-demo-mode.sh status

# Disable for production (REQUIRED before App Store submission)
./scripts/toggle-demo-mode.sh disable

# Enable for development
./scripts/toggle-demo-mode.sh enable
```

## Documentation

All documentation is organized in `/docs`:
- **Publishing Checklist**: `docs/PUBLISHING_CHECKLIST.md`
- **App Store guides**: `docs/app-store/`
- **Deployment guides**: `docs/deployment/`

## Recent Changes
- 2026-01-28: Demo mode and documentation organization
  - Added demo mode toggle script for production builds
  - Organized 50+ MD files into categorized docs folders
  - Created App Store publishing checklist
- 2026-01-28: Guest mode authentication bypass
  - Added "Continue as Guest" for Supabase maintenance periods
  - Fixed theme persistence across all pages
- 2025-01-28: Initial import and Replit environment configuration
  - Configured Expo web to run on port 5000
  - Set up workflow for web development
  - Configured deployment for production
