import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-06-30.basil',
});

// This endpoint controls authorization for Connect payments in real-time
export async function POST(request: Request) {
  try {
    const sig = request.headers.get('stripe-signature')!;
    const body = await request.text();
    
    // Verify webhook signature
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        body, 
        sig, 
        process.env.STRIPE_CONNECT_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET!
      );
    } catch (err: any) {
      console.log(`⚠️  Webhook signature verification failed.`, err.message);
      return new Response('Webhook Error: Invalid signature', { status: 400 });
    }

    console.log(`📥 Received Connect event: ${event.type}`);

    // Handle authorization request
    if (event.type === 'payment_intent.requires_action' || 
        event.type === 'payment_intent.processing' ||
        event.type === 'charge.pending') {
      
      const authDecision = await makeAuthorizationDecision(event.data.object);
      console.log(`🔍 Authorization decision:`, authDecision);
      
      return Response.json(authDecision);
    }

    // Handle other Connect events for monitoring
    switch (event.type) {
      case 'account.updated':
        await handleAccountUpdated(event.data.object);
        break;
      case 'application_fee.created':
        await handleApplicationFeeCreated(event.data.object);
        break;
      case 'transfer.created':
        await handleTransferCreated(event.data.object);
        break;
      default:
        console.log(`Unhandled Connect event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (error: any) {
    console.error('❌ Connect authorization webhook error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }), 
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Main authorization decision logic
async function makeAuthorizationDecision(paymentData: any): Promise<{
  approved: boolean;
  reason: string;
  metadata?: Record<string, any>;
  amount_adjustment?: number;
}> {
  const userId = paymentData.metadata?.user_id;
  const amount = (paymentData.amount || paymentData.amount_received) / 100; // Convert from cents
  const connectedAccountId = paymentData.transfer_data?.destination || paymentData.destination;
  const subscriptionId = paymentData.metadata?.subscription_id;
  
  console.log(`🔍 Authorizing payment: $${amount} for user ${userId} to account ${connectedAccountId}`);

  try {
    // 1. Basic validation
    if (!userId || !amount || !connectedAccountId) {
      return {
        approved: false,
        reason: 'Missing required payment information',
      };
    }

    // 2. Check if user exists and is active
    const userValidation = await validateUser(userId);
    if (!userValidation.valid) {
      return {
        approved: false,
        reason: userValidation.reason,
      };
    }

    // 3. Check user's subscription status
    const subscriptionValidation = await validateUserSubscription(userId);
    if (!subscriptionValidation.valid) {
      return {
        approved: false,
        reason: subscriptionValidation.reason,
      };
    }

    // 4. Check spending limits
    const spendingValidation = await validateSpendingLimits(userId, amount);
    if (!spendingValidation.valid) {
      return {
        approved: false,
        reason: spendingValidation.reason,
      };
    }

    // 5. Validate connected account/provider
    const providerValidation = await validateProvider(connectedAccountId);
    if (!providerValidation.valid) {
      return {
        approved: false,
        reason: providerValidation.reason,
      };
    }

    // 6. Fraud detection
    const fraudCheck = await detectSuspiciousActivity(userId, amount, connectedAccountId);
    if (fraudCheck.suspicious) {
      return {
        approved: false,
        reason: fraudCheck.reason,
      };
    }

    // 7. Business rule checks
    const businessRuleCheck = await applyBusinessRules(userId, amount, subscriptionId);
    if (!businessRuleCheck.approved) {
      return businessRuleCheck;
    }

    // All checks passed - approve the payment!
    await logApprovedTransaction(userId, amount, connectedAccountId, subscriptionId);
    
    return {
      approved: true,
      reason: 'Payment authorized by SubTrack Pro platform',
      metadata: {
        approved_by: 'subtrack_pro',
        approval_timestamp: new Date().toISOString(),
        user_id: userId,
        validation_score: 'high',
      },
    };

  } catch (error: any) {
    console.error('💥 Authorization decision error:', error);
    return {
      approved: false,
      reason: 'System error during authorization check',
    };
  }
}

// Validation functions
async function validateUser(userId: string): Promise<{ valid: boolean; reason: string }> {
  try {
    // TODO: Replace with actual database query
    // const user = await db.users.findById(userId);
    
    // Mock validation for now
    if (!userId || userId === 'banned_user') {
      return { valid: false, reason: 'User account not found or banned' };
    }
    
    return { valid: true, reason: 'User validated' };
  } catch (error) {
    return { valid: false, reason: 'User validation error' };
  }
}

async function validateUserSubscription(userId: string): Promise<{ valid: boolean; reason: string }> {
  try {
    // TODO: Replace with actual subscription check
    // const subscription = await db.subscriptions.findByUserId(userId);
    
    // Mock validation - in production, check actual subscription status
    if (userId === 'no_subscription_user') {
      return { valid: false, reason: 'No active subscription found' };
    }
    
    return { valid: true, reason: 'Subscription validated' };
  } catch (error) {
    return { valid: false, reason: 'Subscription validation error' };
  }
}

async function validateSpendingLimits(userId: string, amount: number): Promise<{ valid: boolean; reason: string }> {
  try {
    // TODO: Replace with actual spending limit checks
    // const monthlySpending = await db.transactions.getMonthlyTotal(userId);
    // const userLimits = await db.users.getLimits(userId);
    
    // Mock limits for demonstration
    const mockMonthlyLimit = 1000; // $1000/month
    const mockPerTransactionLimit = 200; // $200/transaction
    const mockCurrentSpending = 450; // Current month spending
    
    if (amount > mockPerTransactionLimit) {
      return { valid: false, reason: `Transaction exceeds per-transaction limit of $${mockPerTransactionLimit}` };
    }
    
    if (mockCurrentSpending + amount > mockMonthlyLimit) {
      return { valid: false, reason: `Transaction would exceed monthly limit of $${mockMonthlyLimit}` };
    }
    
    return { valid: true, reason: 'Spending limits validated' };
  } catch (error) {
    return { valid: false, reason: 'Spending limit validation error' };
  }
}

async function validateProvider(connectedAccountId: string): Promise<{ valid: boolean; reason: string }> {
  try {
    // Check if the connected account is approved and active
    const account = await stripe.accounts.retrieve(connectedAccountId);
    
    if (!account.charges_enabled) {
      return { valid: false, reason: 'Provider account not enabled for charges' };
    }
    
    if (!account.payouts_enabled) {
      return { valid: false, reason: 'Provider account not enabled for payouts' };
    }
    
    // TODO: Add custom provider validation from your database
    // const provider = await db.providers.findByAccountId(connectedAccountId);
    
    return { valid: true, reason: 'Provider validated' };
  } catch (error) {
    return { valid: false, reason: 'Provider validation error' };
  }
}

async function detectSuspiciousActivity(userId: string, amount: number, providerId: string): Promise<{ suspicious: boolean; reason: string }> {
  try {
    // TODO: Implement sophisticated fraud detection
    // const recentTransactions = await db.transactions.getRecent(userId, '1hour');
    
    // Mock fraud detection rules
    if (amount > 1000) {
      return { suspicious: true, reason: 'Unusually large transaction amount' };
    }
    
    if (userId === 'suspicious_user') {
      return { suspicious: true, reason: 'User flagged for suspicious activity' };
    }
    
    return { suspicious: false, reason: 'No suspicious activity detected' };
  } catch (error) {
    return { suspicious: true, reason: 'Fraud detection system error' };
  }
}

async function applyBusinessRules(userId: string, amount: number, subscriptionId?: string): Promise<{
  approved: boolean;
  reason: string;
  amount_adjustment?: number;
}> {
  try {
    // Business rule: Free users have lower limits
    const userTier = await getUserTier(userId);
    
    if (userTier === 'free' && amount > 50) {
      return {
        approved: false,
        reason: 'Free tier users limited to $50 per transaction',
      };
    }
    
    // Business rule: First transaction with new provider requires lower amount
    const isFirstTimeProvider = await isFirstTransactionWithProvider(userId, subscriptionId);
    if (isFirstTimeProvider && amount > 25) {
      return {
        approved: false,
        reason: 'First transaction with new provider limited to $25',
      };
    }
    
    return {
      approved: true,
      reason: 'Business rules validated',
    };
  } catch (error) {
    return {
      approved: false,
      reason: 'Business rule validation error',
    };
  }
}

// Helper functions
async function getUserTier(userId: string): Promise<'free' | 'pro' | 'enterprise'> {
  // TODO: Get actual user tier from database
  return 'pro'; // Mock
}

async function isFirstTransactionWithProvider(userId: string, subscriptionId?: string): Promise<boolean> {
  // TODO: Check transaction history
  return false; // Mock
}

async function logApprovedTransaction(userId: string, amount: number, providerId: string, subscriptionId?: string): Promise<void> {
  console.log(`✅ Approved transaction logged: User ${userId}, Amount $${amount}, Provider ${providerId}`);
  // TODO: Log to database for analytics
}

// Connect event handlers
async function handleAccountUpdated(account: any): Promise<void> {
  console.log(`📊 Connect account updated: ${account.id}`);
  // TODO: Update provider status in database
}

async function handleApplicationFeeCreated(fee: any): Promise<void> {
  console.log(`💰 Application fee created: $${fee.amount / 100} (${fee.id})`);
  // TODO: Log revenue for analytics
}

async function handleTransferCreated(transfer: any): Promise<void> {
  console.log(`💸 Transfer created: $${transfer.amount / 100} to ${transfer.destination}`);
  // TODO: Log successful provider payment
}