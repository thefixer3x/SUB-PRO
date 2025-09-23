# Environment Variables Setup

To run the application locally, you need to set up the required environment variables.

## Create a .env file

Create a `.env` file in the root of your project with the following variables:

```
# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Stripe Configuration
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key

# AdMob Configuration (Optional)
EXPO_PUBLIC_ADMOB_APP_ID=your_admob_app_id
EXPO_PUBLIC_ADMOB_BANNER_ID=your_admob_banner_id
EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID=your_admob_interstitial_id
EXPO_PUBLIC_ADMOB_REWARDED_ID=your_admob_rewarded_id

# Feature Flags
EXPO_PUBLIC_MONETIZATION_V1=true
EXPO_PUBLIC_EMBED_FINANCE_BETA=false
EXPO_PUBLIC_COMPLIANCE_CENTER=true
EXPO_PUBLIC_SECURITY_MONITORING=true
EXPO_PUBLIC_PARTNER_HUB=true
EXPO_PUBLIC_SOCIAL_V1=true
```

## Obtaining the values

1. **Supabase Configuration**:
   - Go to your Supabase project dashboard
   - Copy the Project URL from Project Settings > API
   - Copy the anon key from Project Settings > API

2. **Stripe Configuration**:
   - Go to your Stripe dashboard
   - Find your publishable key in Developers > API keys

## Testing your configuration

Run `npm run test-supabase` to verify that your environment variables are properly set.

## For deployment

When deploying to Vercel, Netlify, or other platforms, make sure to set these environment variables in the platform's settings.