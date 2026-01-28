# Architecture: Stripe + Supabase Integration - SubTrack Pro

## 🏗️ System Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Mobile App    │────│  Your API       │────│     Stripe      │
│  (React Native)│    │  (Serverless)   │    │   (Payments)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              │
                       ┌─────────────────┐
                       │   Supabase      │
                       │  (Database)     │
                       └─────────────────┘
```

## 🔄 Data Flow & Responsibilities

### **Direct API Calls (Your App → Stripe)**
These endpoints communicate **directly with Stripe APIs**:

```typescript
// 1. Create Virtual Card
POST /api/embedded-finance/virtual-cards/create
├── Validates user in Supabase ✓
├── Calls stripe.issuing.cards.create() → Stripe
├── Stores card metadata in Supabase ✓
└── Returns sanitized card info to app

// 2. Create Connected Account  
POST /api/connect/accounts/create
├── Validates provider info in Supabase ✓
├── Calls stripe.accounts.create() → Stripe
├── Stores account mapping in Supabase ✓
└── Returns account details to app

// 3. Process Payment
POST /api/connect/payments/create
├── Checks user limits in Supabase ✓
├── Calls stripe.paymentIntents.create() → Stripe
├── Logs transaction in Supabase ✓
└── Returns payment result to app
```

### **Webhook Handlers (Stripe → Your App)**
These endpoints **receive data FROM Stripe**:

```typescript
// 1. Subscription Webhooks
POST /api/stripe/webhook ← Stripe sends events
├── Receives payment confirmations
├── Updates user subscription status in Supabase ✓
└── Triggers real-time notifications

// 2. Authorization Webhooks  
POST /api/connect/webhooks/authorization ← Stripe asks permission
├── Receives payment authorization request
├── Checks user/limits in Supabase ✓
├── Returns approve/decline decision → Stripe
└── Logs decision in Supabase ✓

// 3. Card Transaction Webhooks
POST /api/stripe/webhook ← Stripe sends card events
├── Receives virtual card transaction data
├── Updates spending analytics in Supabase ✓
└── Sends real-time notification to user
```

## 🗄️ Supabase Database Schema

### **Users Table**
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  stripe_customer_id TEXT,
  subscription_status TEXT DEFAULT 'free',
  monthly_spending_limit DECIMAL DEFAULT 1000,
  per_transaction_limit DECIMAL DEFAULT 200,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### **Connected Providers Table**
```sql
CREATE TABLE providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  stripe_account_id TEXT UNIQUE,
  category TEXT,
  status TEXT DEFAULT 'pending',
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### **Virtual Cards Table**
```sql
CREATE TABLE virtual_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  stripe_card_id TEXT UNIQUE,
  subscription_id TEXT,
  spending_limit DECIMAL,
  status TEXT DEFAULT 'active',
  last_4 TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### **Transactions Table**
```sql
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  provider_id UUID REFERENCES providers(id),
  stripe_payment_intent_id TEXT,
  amount DECIMAL NOT NULL,
  platform_fee DECIMAL,
  status TEXT DEFAULT 'pending',
  authorization_decision TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 🔄 Complete Flow Examples

### **Example 1: User Creates Virtual Card**

```typescript
// 1. User clicks "Create Card" in app
// 2. App calls your API
POST /api/embedded-finance/virtual-cards/create
{
  "userId": "user-123",
  "spendingLimit": 50,
  "subscriptionId": "netflix-subscription"
}

// 3. Your API validates and creates
async function createVirtualCard(request) {
  // Check user exists in Supabase
  const user = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();
    
  if (!user) throw new Error('User not found');
  
  // Create card in Stripe
  const card = await stripe.issuing.cards.create({
    cardholder: user.stripe_cardholder_id,
    currency: 'usd',
    type: 'virtual',
    spending_controls: {
      spending_limits: [{ amount: spendingLimit * 100, interval: 'monthly' }]
    }
  });
  
  // Store card metadata in Supabase
  await supabase.from('virtual_cards').insert({
    user_id: userId,
    stripe_card_id: card.id,
    subscription_id: subscriptionId,
    spending_limit: spendingLimit,
    last_4: card.last4
  });
  
  return { cardId: card.id, last4: card.last4 };
}
```

### **Example 2: Payment Authorization Flow**

```typescript
// 1. User tries to pay Netflix with virtual card
// 2. Stripe pauses and asks your authorization webhook
POST /api/connect/webhooks/authorization
{
  "type": "payment_intent.requires_action",
  "data": {
    "object": {
      "amount": 1599, // $15.99
      "metadata": { "user_id": "user-123" }
    }
  }
}

// 3. Your webhook checks Supabase and decides
async function authorizePayment(paymentIntent) {
  const userId = paymentIntent.metadata.user_id;
  const amount = paymentIntent.amount / 100;
  
  // Check user's current spending this month
  const { data: monthlySpending } = await supabase
    .from('transactions')
    .select('amount')
    .eq('user_id', userId)
    .gte('created_at', startOfMonth())
    .sum('amount');
    
  // Check user's limits
  const { data: user } = await supabase
    .from('users')
    .select('monthly_spending_limit')
    .eq('id', userId)
    .single();
    
  const decision = (monthlySpending + amount) <= user.monthly_spending_limit;
  
  // Log decision in Supabase
  await supabase.from('transactions').insert({
    user_id: userId,
    amount: amount,
    authorization_decision: decision ? 'approved' : 'declined',
    stripe_payment_intent_id: paymentIntent.id
  });
  
  // Return decision to Stripe
  return { approved: decision };
}
```

## 🔐 Environment Variables Setup

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_CONNECT_WEBHOOK_SECRET=whsec_...

# Supabase Configuration  
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# App Configuration
NEXT_PUBLIC_DOMAIN=https://subtrack-pro.lanonasis.com
```

## 📊 Real-time Updates Flow

```typescript
// When Stripe webhook is received
async function handleStripeWebhook(event) {
  // 1. Update Supabase database
  await updateDatabase(event);
  
  // 2. Send real-time notification via Supabase
  await supabase
    .from('notifications')
    .insert({
      user_id: event.metadata.user_id,
      type: 'transaction_completed',
      data: event.data
    });
    
  // 3. Supabase real-time triggers mobile app update
  // App automatically shows new transaction
}
```

## 🚀 Key Benefits of This Architecture

### **1. Best of Both Worlds**
- **Stripe**: Handles complex payment processing, compliance, security
- **Supabase**: Fast queries, real-time updates, business logic storage

### **2. Scalable & Secure**
- Sensitive payment data stays in Stripe
- Business data and analytics in Supabase
- Real-time notifications via Supabase channels

### **3. Developer Friendly**
- Simple REST APIs for mobile app
- Webhook handlers for async processing
- TypeScript support throughout

## 🔧 Implementation Order

### **Phase 1: Core Setup**
1. Set up Supabase database schema
2. Create basic API endpoints with Stripe calls
3. Implement webhook handlers

### **Phase 2: Business Logic**
1. Add authorization logic in webhooks
2. Implement spending limits and controls
3. Create analytics and reporting

### **Phase 3: Real-time Features**
1. Add Supabase real-time subscriptions
2. Implement push notifications
3. Create live dashboard updates

---

**This architecture gives you the flexibility to handle complex business logic while leveraging Stripe's powerful payment infrastructure!** 🚀

Last Updated: 2025-07-08