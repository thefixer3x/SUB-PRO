# Stripe Integration Guide - SubTrack Pro

## ✅ Configuration Complete

### 1. **Products Created**
- **Basic Plan**: prod_Sdid8AZs4RXD4c (Free tier)
- **Pro Plan**: prod_SdideR9hikhJ6V ($4.99/month)
- **Enterprise Plan**: prod_SdidKo4BZeQRwb ($9.99/month)

### 2. **Pricing IDs**
```
Pro Monthly: price_1RiSAL2KF4vMCpn8wUyDio3N ($4.99/month)
Enterprise Monthly: price_1RiSAi2KF4vMCpn8B18AAI8v ($9.99/month)
```

### 3. **Webhook Configuration**
- **Endpoint URL**: https://subtrack-pro.com/api/stripe/webhook
- **Webhook Secret**: whsec_BsDevFB9UiEuHhsUvXMCD2sirRFa8qLd
- **Events**: All events enabled

### 4. **API Keys**
- **Publishable Key**: pk_live_51RBGUq2KF4vMCpn8m0UJW3YMyoWdTWee91EgbSj9nU6uNuQQOO8oPA7S57nuFfFVKO4O5ohKR7gdhQxovZmtKW9y00rSSLNFJB
- **Secret Key**: Stored in .env file

---

## 🔧 Implementation Guide

### Step 1: Create Subscription Flow

```typescript
// In your subscription page component
import { stripeService } from '@/services/stripe';

const subscribeToPro = async () => {
  try {
    const { url } = await stripeService.createCheckoutSession({
      priceId: process.env.STRIPE_PRO_PRICE_ID,
      customerId: user.stripeCustomerId, // if exists
      successUrl: `${window.location.origin}/subscription/success`,
      cancelUrl: `${window.location.origin}/subscription/cancel`,
      metadata: {
        userId: user.id,
        plan: 'pro'
      }
    });
    
    // Redirect to Stripe Checkout
    window.location.href = url;
  } catch (error) {
    console.error('Subscription error:', error);
  }
};
```

### Step 2: Handle Webhook Events

Create or update `/app/api/stripe/webhook+api.ts`:

```typescript
import { createServerStripe } from '@/services/stripe-server';
import { headers } from 'next/headers';

const stripe = createServerStripe();
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: Request) {
  const body = await request.text();
  const signature = headers().get('stripe-signature')!;

  let event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  // Handle the event
  switch (event.type) {
    case 'customer.subscription.created':
      const subscription = event.data.object;
      // Update user to Pro in your database
      await updateUserSubscription(subscription.metadata.userId, {
        status: 'active',
        plan: subscription.metadata.plan,
        stripeSubscriptionId: subscription.id,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000)
      });
      break;
      
    case 'customer.subscription.deleted':
      // Downgrade user to free tier
      await downgradeUser(event.data.object.metadata.userId);
      break;
      
    case 'invoice.payment_failed':
      // Send email notification
      await notifyPaymentFailed(event.data.object);
      break;
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
}
```

### Step 3: Customer Portal

Allow users to manage their subscription:

```typescript
const openCustomerPortal = async () => {
  try {
    const { url } = await stripeService.createPortalSession({
      customerId: user.stripeCustomerId,
      returnUrl: `${window.location.origin}/account`
    });
    
    window.location.href = url;
  } catch (error) {
    console.error('Portal error:', error);
  }
};
```

---

## 🧪 Testing

### Test Cards
Use these in test mode (switch keys in .env):
- Success: 4242 4242 4242 4242
- Decline: 4000 0000 0000 0002
- 3D Secure: 4000 0025 0000 3155

### Webhook Testing
```bash
# Forward webhooks to local development
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Trigger test events
stripe trigger payment_intent.succeeded
```

---

## 📊 Stripe Dashboard Links

- **Products**: https://dashboard.stripe.com/products
- **Customers**: https://dashboard.stripe.com/customers
- **Subscriptions**: https://dashboard.stripe.com/subscriptions
- **Webhooks**: https://dashboard.stripe.com/webhooks
- **Test Mode**: https://dashboard.stripe.com/test/dashboard

---

## 🚨 Important Notes

1. **Webhook Secret**: Keep the webhook secret secure and never commit it to public repos
2. **Price IDs**: Update the app if you change pricing
3. **Customer Portal**: Configure branding at https://dashboard.stripe.com/settings/billing/portal
4. **Tax Settings**: Configure tax collection if needed
5. **Payment Methods**: Enable additional payment methods in Stripe Dashboard

---

## 📱 Mobile App Integration

For React Native (Expo):

```typescript
import { useStripe } from '@stripe/stripe-react-native';

const { initPaymentSheet, presentPaymentSheet } = useStripe();

// Initialize payment sheet
const initializePaymentSheet = async () => {
  const { paymentIntent, ephemeralKey, customer } = 
    await fetchPaymentSheetParams();

  const { error } = await initPaymentSheet({
    merchantDisplayName: "SubTrack Pro",
    customerId: customer,
    customerEphemeralKeySecret: ephemeralKey,
    paymentIntentClientSecret: paymentIntent,
  });
};
```

---

## 🔄 Next Steps

1. **Test the Integration**
   - Create a test subscription
   - Verify webhook events are received
   - Test customer portal

2. **Configure Customer Portal**
   - Go to https://dashboard.stripe.com/settings/billing/portal
   - Customize branding
   - Set cancellation policy

3. **Set Up Production**
   - Deploy webhook endpoint
   - Test with real payment method
   - Monitor first transactions

---

---

## 💳 Virtual Cards Setup (Stripe Issuing)

### Current Status: **Needs Activation**

**Action Required**: 
1. Visit https://dashboard.stripe.com/issuing/overview
2. Complete Stripe Issuing onboarding
3. Enable virtual card creation

### Once Enabled:

#### Create Virtual Cards
```typescript
// API endpoint: /api/embedded-finance/virtual-cards/create
const createVirtualCard = async (subscriptionId: string, spendingLimit: number) => {
  const response = await fetch('/api/embedded-finance/virtual-cards/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: 'stripe',
      subscriptionId,
      userId: user.id,
      spendingLimit: spendingLimit, // in dollars
      merchantCategory: 'online_services' // or specific category
    })
  });
  
  return response.json();
};
```

#### Virtual Card Features Available:
- **Spending Limits**: Monthly limits per card
- **Merchant Categories**: Restrict to specific merchant types
- **Real-time Controls**: Enable/disable instantly
- **Transaction Monitoring**: Real-time notifications
- **Secure Details**: Encrypted card numbers

#### Merchant Categories Supported:
- `online_services` - Subscription services
- `software_services` - SaaS platforms
- `digital_goods` - Apps, games, media
- `streaming_services` - Netflix, Spotify, etc.

### Integration Points:

1. **Subscription Creation**
   ```typescript
   // When user subscribes to a service
   const virtualCard = await createVirtualCard(subscriptionId, monthlyLimit);
   ```

2. **Card Management**
   ```typescript
   // Update spending limits
   await updateCardSpendingLimit(cardId, newLimit);
   
   // Pause/resume card
   await toggleCardStatus(cardId, 'active' | 'inactive');
   ```

3. **Transaction Webhooks**
   ```typescript
   // Listen for card transactions
   case 'issuing_transaction.created':
     const transaction = event.data.object;
     await logTransaction(transaction);
     break;
   ```

### Required Stripe Issuing Settings:

1. **Business Information**
   - Legal business name
   - Tax ID (EIN)
   - Business address
   - Beneficial owners

2. **Compliance Requirements**
   - KYC documentation
   - Terms of service update
   - Privacy policy update

3. **Card Program Setup**
   - Card design (optional)
   - Default spending controls
   - Fraud prevention settings

### Fees (Stripe Issuing):
- **Card Creation**: $2.00 per virtual card
- **Transactions**: $0.10 per authorization
- **No monthly fees** for inactive cards

---

## 🔄 Alternative: Weavr Virtual Cards

If Stripe Issuing approval takes time, you can use Weavr:

```bash
# Add to .env when ready
WEAVR_API_KEY=your_weavr_api_key
WEAVR_PROGRAMME_ID=your_weavr_programme_id
```

The app already supports Weavr as a fallback provider in the virtual cards API.

---

Last Updated: 2025-07-08
IP Allowed: 41.184.6.111