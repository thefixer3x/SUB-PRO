import Stripe from 'stripe';

// Initialize Stripe with your secret key (server-side only)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { provider, subscriptionId, userId, spendingLimit, merchantCategory } = body;

    // Validate input
    if (!subscriptionId || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (provider === 'stripe') {
      return await createStripeIssuingCard(body);
    } else if (provider === 'weavr') {
      return await createWeavrCard(body);
    } else {
      return new Response(
        JSON.stringify({ error: 'Unsupported provider' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Virtual card creation error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function createStripeIssuingCard(params: any) {
  try {
    const { subscriptionId, userId, spendingLimit, merchantCategory, userEmail, userName, userPhone } = params;

    // Step 1: Create or get Stripe customer (following Stripe docs)
    let customer;
    try {
      // Search for existing customer by email or metadata
      const existingCustomers = await stripe.customers.search({
        query: `email:'${userEmail}' OR metadata['userId']:'${userId}'`,
        limit: 1,
      });
      
      customer = existingCustomers.data[0];
      
      if (!customer) {
        // Create new customer if not found
        customer = await stripe.customers.create({
          email: userEmail,
          name: userName,
          metadata: {
            userId: userId,
            subscriptionId: subscriptionId,
          },
        });
      }
    } catch (error) {
      console.error('Error managing customer:', error);
      throw new Error('Failed to manage customer');
    }

    // Step 2: Create cardholder (following Stripe Issuing docs)
    const cardholder = await stripe.issuing.cardholders.create({
      type: 'individual',
      name: userName || `User ${userId}`,
      email: userEmail || customer.email || `user-${userId}@subtrack-pro.lanonasis.com`,
      phone_number: userPhone || '+1234567890', // Should be provided by user
      billing: {
        address: {
          line1: '123 Main St', // Should be user's actual address
          city: 'San Francisco',
          state: 'CA',
          country: 'US',
          postal_code: '94111',
        },
      },
      metadata: {
        userId: userId,
        subscriptionId: subscriptionId,
        customerId: customer.id,
      },
    });

    // Step 3: Issue virtual card (following Stripe Issuing docs)
    const card = await stripe.issuing.cards.create({
      cardholder: cardholder.id,
      type: 'virtual',
      currency: 'usd',
      status: 'active',
      spending_controls: {
        spending_limits: [
          {
            amount: spendingLimit * 100, // Convert to cents
            interval: 'monthly',
          },
          {
            amount: Math.min(spendingLimit * 100, 50000), // Max $500 per transaction
            interval: 'per_authorization',
          },
        ],
        allowed_categories: merchantCategory ? [merchantCategory] : [
          'computer_software_stores',
          'digital_goods_media',
          'online_services',
        ],
        blocked_categories: [
          'betting_casino_gambling',
          'government_licensed_online_casions_online_gambling_us_region_only',
          'automated_cash_disburse',
          'manual_cash_disburse',
        ],
      },
      metadata: {
        subscription_id: subscriptionId,
        user_id: userId,
        customer_id: customer.id,
        cardholder_id: cardholder.id,
        purpose: 'subscription_payment',
        created_via: 'subtrack_pro_app',
      },
    });

    // Return sanitized card data (never expose full card details to client)
    const sanitizedCard = {
      id: card.id,
      subscriptionId: subscriptionId,
      userId: userId,
      last4: card.last4,
      brand: card.brand,
      status: card.status,
      spendingLimit: spendingLimit,
      currency: card.currency,
      createdAt: new Date(card.created * 1000),
      updatedAt: new Date(),
      provider: 'stripe',
      providerCardId: card.id,
      merchantCategory: merchantCategory,
    };

    return Response.json(sanitizedCard);
  } catch (error) {
    console.error('Stripe card creation failed:', error);
    throw error;
  }
}

async function createWeavrCard(params: any) {
  // In production, use Weavr API
  try {
    /*
    const weavrResponse = await fetch('https://api.weavr.io/cards', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.WEAVR_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        programmeId: process.env.WEAVR_PROGRAMME_ID,
        cardholderMobileNumber: userPhone,
        spendRules: [
          {
            spendLimit: {
              value: params.spendingLimit,
              interval: 'MONTHLY',
            },
          },
        ],
        merchantCategory: params.merchantCategory,
      }),
    });

    const weavrCard = await weavrResponse.json();
    */

    // Mock response for development
    const mockCard = {
      id: `weavr_card_${Date.now()}`,
      subscriptionId: params.subscriptionId,
      userId: params.userId,
      cardNumber: 'encrypted_card_number',
      last4: '5555',
      expiryMonth: 11,
      expiryYear: 2027,
      cvv: 'encrypted_cvv',
      status: 'active',
      spendingLimit: params.spendingLimit,
      merchantCategory: params.merchantCategory,
      createdAt: new Date(),
      updatedAt: new Date(),
      provider: 'weavr',
      providerCardId: `weavr_${Date.now()}`,
    };

    console.log('Created Weavr card:', mockCard.id);

    return Response.json(mockCard);
  } catch (error) {
    console.error('Weavr card creation failed:', error);
    throw error;
  }
}