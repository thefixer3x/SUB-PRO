# Deployment Guide for SubTrack Pro

## Prerequisites
1. Ensure all environment variables are set up in your deployment platform
2. Have your Supabase project URL and anon key ready
3. Have your Stripe publishable key ready

## Vercel Deployment

### 1. Set up Environment Variables in Vercel
Go to your Vercel project settings > Environment Variables and add:
- `EXPO_PUBLIC_SUPABASE_URL` = your Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` = your Supabase anon key
- `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` = your Stripe publishable key

### 2. Configure Environment Variable References
In your Vercel project, you can also use the @ syntax to reference secrets:
- `EXPO_PUBLIC_SUPABASE_URL` = @SUPABASE_URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` = @SUPABASE_ANON_KEY
- `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` = @STRIPE_PUBLISHABLE_KEY

Then create the secrets in Vercel CLI:
```bash
vercel secrets add supabase-url "your_supabase_url"
vercel secrets add supabase-anon-key "your_supabase_anon_key"
vercel secrets add stripe-publishable-key "your_stripe_publishable_key"
```

## Netlify Deployment

### 1. Set up Environment Variables in Netlify
Go to your Netlify site settings > Build & deploy > Environment and add:
- `EXPO_PUBLIC_SUPABASE_URL` = your Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` = your Supabase anon key
- `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` = your Stripe publishable key

## Common Issues and Solutions

### Blank Screen Issue
This typically occurs when:
1. Environment variables are missing
2. Routing is not configured correctly
3. Build process fails silently

### Authentication Not Working
This typically occurs when:
1. Supabase environment variables are not set
2. Supabase project URL or anon key is incorrect
3. CORS settings in Supabase are not configured for your domain

### Overlapping Cards on Index Page
This is likely a CSS/layout issue that may be related to:
1. Responsive design not working correctly
2. Missing styles in production build
3. CSS not being properly bundled

## Testing Your Deployment

1. After deployment, visit your site and check the browser console for errors
2. Verify that environment variables are being loaded correctly
3. Test the sign up functionality with a test account
4. Check that all pages load without errors

## Troubleshooting Steps

1. Clear your browser cache and try again
2. Check the network tab in developer tools for failed requests
3. Verify all environment variables are correctly set
4. Check the build logs for any errors or warnings
5. Ensure your Supabase project is configured to accept requests from your deployed domain

## OTA Deployment for Mobile Apps

For over-the-air updates to mobile apps:
1. Ensure you're using the correct EAS build profiles
2. Verify that expo-updates is properly configured
3. Check that your runtimeVersion is set correctly in app.json