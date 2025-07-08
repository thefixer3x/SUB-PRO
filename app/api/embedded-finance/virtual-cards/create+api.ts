import Stripe from 'stripe';

// Initialize Stripe with your secret key (server-side only)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-06-30.basil',
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
    const { subscriptionId, userId, spendingLimit, merchantCategory } = params;

    // Create or get Stripe customer
    let customer;
    try {
      // Try to find existing customer by metadata
      const customers = await stripe.customers.list({
        limit: 1,
        expand: ['data'],
      });
      
      customer = customers.data.find((c: any) => c.metadata?.userId === userId);
      
      if (!customer) {
        // Create new customer if not found
        customer = await stripe.customers.create({
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

    // Create cardholder for the virtual card
    const cardholder = await stripe.issuing.cardholders.create({
      name: `User ${userId}`,
      email: customer.email || `user-${userId}@subtrack.app`,
      type: 'individual',
      billing: {
        address: {
          line1: '123 Main St',
          city: 'San Francisco',
          state: 'CA',
          postal_code: '94111',
          country: 'US',
        },
      },
      metadata: {
        userId: userId,
        subscriptionId: subscriptionId,
      },
    });

    // Create virtual card with spending controls
    const card = await stripe.issuing.cards.create({
      cardholder: cardholder.id,
      currency: 'usd',
      type: 'virtual',
      spending_controls: {
        spending_limits: [
          {
            amount: spendingLimit * 100, // Convert to cents
            interval: 'monthly',
          },
        ],
        allowed_categories: merchantCategory ? [merchantCategory] : undefined,
      },
      metadata: {
        subscription_id: subscriptionId,
        user_id: userId,
        purpose: 'subscription_payment',
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