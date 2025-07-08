# Stripe Connect Integration Guide - SubTrack Pro

## 🎯 Business Model Analysis

### **Why SubTrack Pro Needs Connect**

1. **Virtual Card Ecosystem**
   - Issue cards for users
   - Handle payments to subscription providers
   - Take platform fees for premium features

2. **Multi-Party Payments**
   - User pays via virtual card
   - Funds flow to subscription service
   - Platform takes percentage for card management

3. **Subscription Marketplace**
   - Connect multiple subscription providers
   - Centralized billing and analytics
   - Revenue sharing models

### **Recommended Connect Model: EXPRESS ACCOUNTS**

**Why Express?**
- ✅ Simplified onboarding for subscription providers
- ✅ Stripe handles compliance and KYC
- ✅ Quick setup with minimal documentation
- ✅ Perfect for marketplace-style platforms

## 🚀 Step 1: Connect Setup

### Business Model Selection
```
Platform Type: Marketplace
Business Model: Express Accounts
Fund Flow: Platform → Connected Accounts
Revenue Model: Application fees + subscription fees
```

### Dashboard Configuration
1. Go to https://dashboard.stripe.com/connect/overview
2. Choose "Marketplace" as your business type
3. Select "Express accounts" for connected accounts
4. Set your platform branding

## 🔧 Step 2: Technical Integration

### Create Connected Account API
```typescript
// /app/api/connect/accounts/create+api.ts
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-06-30.basil',
});

export async function POST(request: Request) {
  try {
    const { email, country = 'US', type = 'express' } = await request.json();

    const account = await stripe.accounts.create({
      type: type,
      country: country,
      email: email,
      business_type: 'company',
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_profile: {
        mcc: '5968', // Software and digital services
        product_description: 'Subscription management services',
      },
    });

    return Response.json({
      account_id: account.id,
      onboarding_url: null, // Will create this next
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
```

### Account Onboarding Links
```typescript
// /app/api/connect/accounts/[accountId]/onboarding+api.ts
export async function POST(request: Request, { params }: { params: { accountId: string } }) {
  try {
    const { accountId } = params;
    const { refresh_url, return_url } = await request.json();

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refresh_url || `${process.env.NEXT_PUBLIC_DOMAIN}/connect/refresh`,
      return_url: return_url || `${process.env.NEXT_PUBLIC_DOMAIN}/connect/success`,
      type: 'account_onboarding',
    });

    return Response.json({
      onboarding_url: accountLink.url,
      expires_at: accountLink.expires_at,
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
```

### Payment with Application Fee
```typescript
// /app/api/connect/payments/create+api.ts
export async function POST(request: Request) {
  try {
    const { 
      amount, 
      currency = 'usd', 
      connected_account_id, 
      application_fee_amount,
      customer_id,
      payment_method_id 
    } = await request.json();

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100, // Convert to cents
      currency: currency,
      customer: customer_id,
      payment_method: payment_method_id,
      application_fee_amount: application_fee_amount * 100,
      transfer_data: {
        destination: connected_account_id,
      },
      confirm: true,
      return_url: `${process.env.NEXT_PUBLIC_DOMAIN}/payments/return`,
    });

    return Response.json({
      payment_intent_id: paymentIntent.id,
      status: paymentIntent.status,
      application_fee: application_fee_amount,
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
```

## 🧪 Step 3: Testing Implementation

### Test Connected Account Creation
```bash
# Create a test connected account
curl -X POST http://localhost:3000/api/connect/accounts/create \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test-merchant@example.com",
    "country": "US",
    "type": "express"
  }'
```

### Test Onboarding Flow
```bash
# Generate onboarding link
curl -X POST http://localhost:3000/api/connect/accounts/acct_xxx/onboarding \
  -H "Content-Type: application/json" \
  -d '{
    "refresh_url": "http://localhost:3000/connect/refresh",
    "return_url": "http://localhost:3000/connect/success"
  }'
```

### Test Payment with Fees
```bash
# Create payment with application fee
curl -X POST http://localhost:3000/api/connect/payments/create \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 15.99,
    "connected_account_id": "acct_xxx",
    "application_fee_amount": 1.60,
    "customer_id": "cus_xxx",
    "payment_method_id": "pm_xxx"
  }'
```

## 🎯 SubTrack Pro Use Cases

### 1. Subscription Provider Onboarding
```typescript
// When a new subscription service wants to integrate
const onboardProvider = async (providerData: {
  name: string;
  email: string;
  website: string;
  category: string;
}) => {
  // Create Connect account
  const account = await createConnectedAccount(providerData.email);
  
  // Generate onboarding link
  const onboardingLink = await createOnboardingLink(account.id);
  
  // Store in database
  await saveProvider({
    ...providerData,
    stripeAccountId: account.id,
    onboardingStatus: 'pending',
  });
  
  return onboardingLink;
};
```

### 2. Virtual Card Subscription Payment
```typescript
// When user pays for subscription with virtual card
const processSubscriptionPayment = async (subscriptionData: {
  userId: string;
  providerId: string;
  amount: number;
  virtualCardId: string;
}) => {
  const provider = await getProvider(subscriptionData.providerId);
  const platformFee = calculatePlatformFee(subscriptionData.amount); // e.g., 2.9% + $0.30
  
  const payment = await stripe.paymentIntents.create({
    amount: subscriptionData.amount * 100,
    currency: 'usd',
    payment_method: subscriptionData.virtualCardId,
    application_fee_amount: platformFee * 100,
    transfer_data: {
      destination: provider.stripeAccountId,
    },
    metadata: {
      userId: subscriptionData.userId,
      providerId: subscriptionData.providerId,
      subscriptionType: 'virtual_card_payment',
    },
  });
  
  return payment;
};
```

### 3. Revenue Analytics
```typescript
// Track platform revenue from Connect fees
const getPlatformRevenue = async (dateRange: { start: Date; end: Date }) => {
  const applications = await stripe.applicationFees.list({
    created: {
      gte: Math.floor(dateRange.start.getTime() / 1000),
      lte: Math.floor(dateRange.end.getTime() / 1000),
    },
    limit: 100,
  });
  
  const totalRevenue = applications.data.reduce((sum, fee) => sum + fee.amount, 0);
  
  return {
    totalRevenue: totalRevenue / 100, // Convert to dollars
    feeCount: applications.data.length,
    averageFee: totalRevenue / applications.data.length / 100,
  };
};
```

## 🔐 Webhook Configuration

### Enhanced Webhook Handler
```typescript
// Add to existing webhook handler in services/stripe.ts
switch (event.type) {
  // Existing events...
  
  // Connect events
  case 'account.updated':
    await this.handleConnectedAccountUpdated(event.data.object);
    break;
    
  case 'application_fee.created':
    await this.handleApplicationFeeCreated(event.data.object);
    break;
    
  case 'transfer.created':
    await this.handleTransferCreated(event.data.object);
    break;
    
  case 'payout.created':
    await this.handlePayoutCreated(event.data.object);
    break;
}
```

## 💰 Revenue Model Examples

### Pricing Structure
```typescript
const calculateFees = (subscriptionAmount: number, plan: 'basic' | 'pro' | 'enterprise') => {
  const baseFee = 0.30; // Stripe's base fee
  
  const platformFees = {
    basic: 0.029, // 2.9% for basic users
    pro: 0.025,   // 2.5% for pro users (discount)
    enterprise: 0.020, // 2.0% for enterprise (bigger discount)
  };
  
  const platformFee = subscriptionAmount * platformFees[plan] + baseFee;
  const providerAmount = subscriptionAmount - platformFee;
  
  return {
    totalAmount: subscriptionAmount,
    platformFee: platformFee,
    providerAmount: providerAmount,
    feePercentage: platformFees[plan] * 100,
  };
};
```

## 🚀 Go Live Checklist

### Pre-Launch
- [ ] Connect business profile completed
- [ ] Express account settings configured
- [ ] Webhook endpoints tested
- [ ] Fee structure finalized
- [ ] Legal terms updated for marketplace
- [ ] Tax handling configured

### Launch
- [ ] Provider onboarding flow tested
- [ ] Payment processing tested
- [ ] Fee collection verified
- [ ] Dispute handling process defined
- [ ] Customer support processes updated

## 📊 Monitoring & Analytics

### Key Metrics to Track
- Connected account onboarding completion rate
- Payment success rate per provider
- Average application fees collected
- Transfer failure rates
- Dispute rates by provider

### Dashboard URLs
- **Connect Overview**: https://dashboard.stripe.com/connect/overview
- **Connected Accounts**: https://dashboard.stripe.com/connect/accounts
- **Application Fees**: https://dashboard.stripe.com/connect/application_fees
- **Transfers**: https://dashboard.stripe.com/connect/transfers

---

## 🎯 Next Steps

1. **Enable Connect**: Visit https://dashboard.stripe.com/connect/overview
2. **Choose Express Accounts**: Best for marketplace model
3. **Test Integration**: Use the API endpoints provided
4. **Onboard Test Providers**: Create sample connected accounts
5. **Test End-to-End**: Virtual card → subscription payment → fee collection

Your Connect integration will enable SubTrack Pro to become a true subscription marketplace with revenue sharing! 🚀

Last Updated: 2025-07-08