import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

export async function GET(request: Request, { params }: { params: { cardId: string } }) {
  try {
    const { cardId } = params;

    if (!cardId) {
      return new Response(
        JSON.stringify({ error: 'Card ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Retrieve card details from Stripe Issuing
    const card = await stripe.issuing.cards.retrieve(cardId);

    // Return sanitized card data (following Stripe security guidelines)
    const sanitizedCard = {
      id: card.id,
      status: card.status,
      type: card.type,
      brand: card.brand,
      last4: card.last4,
      exp_month: card.exp_month,
      exp_year: card.exp_year,
      cardholder: {
        id: card.cardholder,
        name: (card.cardholder as any)?.name,
        email: (card.cardholder as any)?.email,
      },
      spending_controls: card.spending_controls,
      created: card.created,
      metadata: card.metadata,
      currency: card.currency,
    };

    return Response.json(sanitizedCard);
  } catch (error: any) {
    console.error('Error retrieving card:', error);
    
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
      JSON.stringify({ error: 'Failed to retrieve card details' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}