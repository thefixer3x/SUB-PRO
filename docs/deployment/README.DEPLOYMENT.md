# SubTrack Pro - Deployment Guide

## Overview
This guide will help you deploy the SubTrack Pro application to various platforms including Vercel, Netlify, and for mobile app stores.

## Prerequisites
1. Node.js (version 18 or higher)
2. Expo CLI
3. Supabase account with project created
4. Stripe account with API keys
5. Environment variables properly configured

## Environment Variables
Before deploying, ensure you have the following environment variables set:

### Required Variables
```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
```

### Optional Variables
```
EXPO_PUBLIC_ADMOB_APP_ID=your_admob_app_id
EXPO_PUBLIC_ADMOB_BANNER_ID=your_admob_banner_id
EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID=your_admob_interstitial_id
EXPO_PUBLIC_ADMOB_REWARDED_ID=your_admob_rewarded_id
```

## Web Deployment

### Vercel Deployment
1. Push your code to a GitHub repository
2. Connect the repository to Vercel
3. In Vercel project settings, add the required environment variables
4. Configure the build settings:
   - Build Command: `npm run build:production`
   - Output Directory: `dist`
   - Install Command: `npm install`

### Netlify Deployment
1. Push your code to a GitHub repository
2. Connect the repository to Netlify
3. In Netlify project settings, add the required environment variables
4. Configure the build settings:
   - Build Command: `npm run build:production`
   - Publish Directory: `dist`

## Mobile Deployment

### Building for Mobile Stores
1. Ensure you have EAS CLI installed: `npm install -g eas-cli`
2. Log in to your Expo account: `eas login`
3. Build for production: `npm run deploy:production`
4. Submit to stores: `npm run submit:store`

### Environment Variables for Mobile
Mobile builds use the environment variables defined in `eas.json`. Make sure these reference the correct secrets in your Expo account.

## Troubleshooting

### Blank Screen Issues
1. Verify all environment variables are set correctly
2. Check the browser console for JavaScript errors
3. Ensure the routing configuration is correct
4. Verify that the build completed successfully

### Authentication Issues
1. Confirm Supabase environment variables are correct
2. Check that your Supabase project allows connections from your deployed domain
3. Verify that the auth configuration in `lib/supabase.ts` is correct

### Build Failures
1. Check the build logs for specific error messages
2. Ensure all dependencies are properly installed
3. Verify that the Node.js version meets requirements

## Testing Deployments
1. After deployment, test the sign-up flow with a new account
2. Verify that all pages load correctly
3. Test authentication flows (sign up, sign in, sign out)
4. Check that all environment variables are being used correctly

## Monitoring
1. Set up error tracking with Sentry or similar service
2. Monitor performance with Lighthouse or similar tools
3. Set up alerts for build failures

## Updating Deployments
1. Push changes to your repository
2. Automatic deployments will trigger based on your CI/CD configuration
3. For manual deployments, re-run the build commands

## Support
For issues with deployment, please check:
1. The console output in your browser
2. The build logs in your deployment platform
3. The network tab in developer tools for failed requests