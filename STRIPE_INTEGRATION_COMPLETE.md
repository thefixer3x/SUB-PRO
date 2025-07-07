# Stripe Integration Setup Guide

## Overview
SubTrack Pro is now fully integrated with your Stripe account for subscription management and virtual card functionality. This guide explains how to connect your Stripe account safely while preserving the existing security model.

## ✅ What's Been Implemented

### 1. Subscription Management
- **Real Stripe Integration**: `/app/api/stripe/create-checkout-session+api.ts`
- **Customer Portal**: `/app/api/stripe/create-portal-session+api.ts` 
- **Webhook Handling**: `/app/api/stripe/webhook+api.ts`
- **Database Service**: `/services/database.ts` (maintains privacy/security)

### 2. Virtual Card Management
- **Stripe Issuing API**: `/app/api/embedded-finance/virtual-cards/create+api.ts`
- **Non-sensitive Data Only**: Only card metadata stored (no PAN, CVV, etc.)
- **Feature Flag Gated**: Premium feature controlled by user tier

### 3. Security Model Preserved
- **No Client-Side Secrets**: All sensitive operations server-side only
- **Encrypted User Data**: Existing privacy model maintained
- **Safe Database Updates**: Only non-sensitive metadata stored
- **Proper Error Handling**: No sensitive data exposed in errors

## 🔧 Setup Instructions

### Step 1: Create Stripe Account & Products
1. **Sign up for Stripe**: https://dashboard.stripe.com/register
2. **Enable Stripe Issuing**: 
   - Go to Products → Issuing in your Stripe Dashboard
   - Complete verification process
   - Set up card programs
3. **Create Subscription Products**:
   ```bash
   # In Stripe Dashboard, create these products:
   # - "SubTrack Pro" - $9.99/month
   # - "SubTrack Premium" - $29.99/month
   ```

### Step 2: Configure Environment Variables
Update your `.env` file with your Stripe keys:

```bash
# Stripe Configuration (REQUIRED)
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=[Your Stripe Publishable Key]
STRIPE_SECRET_KEY=[Your Stripe Secret Key]
STRIPE_WEBHOOK_SECRET=[Your Webhook Secret]

# Stripe Product/Price IDs (REQUIRED)
STRIPE_PRO_PRICE_ID=[Your Pro Plan Price ID]
STRIPE_PREMIUM_PRICE_ID=[Your Premium Plan Price ID]

# Supabase Configuration (REQUIRED for database)
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### Step 3: Set Up Webhooks
1. **In Stripe Dashboard**:
   - Go to Developers → Webhooks
   - Click "Add endpoint"
   - Endpoint URL: `https://your-domain.com/api/stripe/webhook`
   - Select these events:
     ```
     customer.subscription.created
     customer.subscription.updated
     customer.subscription.deleted
     invoice.payment_succeeded
     invoice.payment_failed
     issuing_card.created
     issuing_authorization.created
     ```
2. **Copy webhook secret** to your environment variables

### Step 4: Database Setup (Optional Tables)
If you want to track Stripe data, add these tables to your Supabase database:

```sql
-- Add stripe_customer_id to profiles table
ALTER TABLE profiles ADD COLUMN stripe_customer_id TEXT;
CREATE INDEX idx_profiles_stripe_customer_id ON profiles(stripe_customer_id);

-- Virtual cards table (optional - for tracking card metadata)
CREATE TABLE IF NOT EXISTS virtual_cards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  stripe_card_id TEXT NOT NULL UNIQUE,
  last4 TEXT NOT NULL,
  brand TEXT NOT NULL,
  status TEXT NOT NULL,
  subscription_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Card authorizations table (optional - for spending tracking)
CREATE TABLE IF NOT EXISTS card_authorizations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stripe_authorization_id TEXT NOT NULL UNIQUE,
  stripe_card_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  merchant_name TEXT NOT NULL,
  merchant_category TEXT NOT NULL DEFAULT 'general',
  approved BOOLEAN NOT NULL,
  transaction_date TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment records table (optional - for payment tracking)
CREATE TABLE IF NOT EXISTS payment_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  stripe_payment_intent_id TEXT,
  stripe_invoice_id TEXT,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL CHECK (status IN ('succeeded', 'failed', 'pending')),
  subscription_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Helper function for tables
CREATE OR REPLACE FUNCTION create_virtual_cards_table_if_not_exists()
RETURNS TEXT AS $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'virtual_cards') THEN
    EXECUTE 'CREATE TABLE virtual_cards (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, user_id UUID, stripe_card_id TEXT, last4 TEXT, brand TEXT, status TEXT, subscription_id TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())';
    RETURN 'virtual_cards table created';
  END IF;
  RETURN 'virtual_cards table already exists';
END;
$$ LANGUAGE plpgsql;
```

## 🚀 How It Works

### Subscription Flow
1. **User clicks upgrade** → Frontend calls `/api/stripe/create-checkout-session`
2. **Stripe Checkout** → User completes payment on Stripe's secure form
3. **Webhook received** → `/api/stripe/webhook` processes subscription events
4. **Database updated** → User's tier updated in Supabase (preserving privacy)
5. **Features unlocked** → Premium features become available

### Virtual Card Flow
1. **Premium user requests card** → Frontend calls `/api/embedded-finance/virtual-cards/create`
2. **Server creates card** → Stripe Issuing API creates virtual card
3. **Metadata stored** → Only non-sensitive data stored in database
4. **Card available** → User can manage card through UI

### Security & Privacy Model
- **Client never sees secrets**: All Stripe secret keys server-side only
- **No sensitive card data**: Only card metadata (last4, brand, status) stored
- **User data encrypted**: Existing privacy model preserved
- **Safe error handling**: No sensitive data exposed in error messages

## 🔍 Testing

### Test Mode
1. Use Stripe test keys (`pk_test_...` and `sk_test_...`)
2. Test subscription with test card: `4242 4242 4242 4242`
3. Test virtual card creation (requires Stripe Issuing test mode)
4. Test webhooks with Stripe CLI: `stripe listen --forward-to localhost:3000/api/stripe/webhook`

### Production Checklist
- [ ] Live Stripe keys configured
- [ ] Webhook endpoint configured with correct URL
- [ ] Stripe Issuing enabled and verified
- [ ] Database tables created (if using optional tracking)
- [ ] SSL certificate valid for webhook URL
- [ ] Environment variables set in deployment platform

## 🛡️ Security Notes

### What's Protected
- Stripe secret keys are server-side only
- No sensitive card data (PAN, CVV) stored in database
- Webhook signature verification prevents tampering
- User data privacy model preserved

### What to Monitor
- Failed webhook deliveries in Stripe Dashboard
- Database errors in application logs
- Subscription status sync between Stripe and database

## 🔗 Integration Points

### Frontend Integration
- Payment flows use `/hooks/usePayments.ts`
- Virtual cards managed via `/components/embeddedFinance/VirtualCardManager.tsx`
- Feature gating via `/contexts/FeatureFlagsContext.tsx`

### Backend Integration
- All Stripe operations in `/app/api/stripe/` directory
- Database operations in `/services/database.ts`
- Configuration in `/config/stripe.ts`

## 📞 Support

### Stripe Support
- Dashboard: https://dashboard.stripe.com/
- Documentation: https://stripe.com/docs
- Support: https://support.stripe.com/

### Common Issues
1. **Webhook failures**: Check URL is publicly accessible and uses HTTPS
2. **Permission errors**: Ensure Stripe Issuing is enabled for your account
3. **Database errors**: Check Supabase connection and table schemas

---

## ✅ Ready for Production

Your SubTrack Pro app is now fully connected to your Stripe account with:
- ✅ Real subscription processing
- ✅ Virtual card management
- ✅ Secure webhook handling
- ✅ Privacy-preserving database updates
- ✅ Premium feature gating

Simply update your environment variables with live Stripe keys and deploy!
