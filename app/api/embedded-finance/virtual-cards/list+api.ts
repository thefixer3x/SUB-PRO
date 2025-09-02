import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    const cardholderId = url.searchParams.get('cardholderId');
    const status = url.searchParams.get('status');
    const limit = parseInt(url.searchParams.get('limit') || '10');

    // Build query parameters for Stripe
    const listParams: any = {
      limit: Math.min(limit, 100), // Stripe limit
    };

    if (cardholderId) {
      listParams.cardholder = cardholderId;
    }

    if (status && ['active', 'inactive', 'canceled'].includes(status)) {
      listParams.status = status;
    }

    // List cards from Stripe Issuing
    const cards = await stripe.issuing.cards.list(listParams);

    // Filter by userId if provided (since Stripe doesn't support metadata filtering in list)
    let filteredCards = cards.data;
    if (userId) {
      filteredCards = cards.data.filter(card => card.metadata?.user_id === userId);
    }

    // Return sanitized card data
    const sanitizedCards = filteredCards.map(card => ({
      id: card.id,
      status: card.status,
      type: card.type,
      brand: card.brand,
      last4: card.last4,
      exp_month: card.exp_month,
      exp_year: card.exp_year,
      cardholder: card.cardholder,
      spending_controls: {
        spending_limits: card.spending_controls?.spending_limits?.map(limit => ({
          amount: limit.amount / 100, // Convert back to dollars
          interval: limit.interval,
        })),
        allowed_categories: card.spending_controls?.allowed_categories,
        blocked_categories: card.spending_controls?.blocked_categories,
      },
      created: card.created,
      metadata: {
        subscription_id: card.metadata?.subscription_id,
        user_id: card.metadata?.user_id,
        purpose: card.metadata?.purpose,
      },
      currency: card.currency,
    }));

    return Response.json({
      cards: sanitizedCards,
      has_more: cards.has_more,
      total_count: filteredCards.length,
    });
  } catch (error: any) {
    console.error('Error listing cards:', error);
    
    if (error instanceof Stripe.errors.StripeError) {
      return new Response(
        JSON.stringify({ 
          error: 'Stripe error: ' + error.message,
          type: error.type 
        }),
        {
          status: error.statusCode || 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
    
    return new Response(
      JSON.stringify({ error: 'Failed to list cards' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}