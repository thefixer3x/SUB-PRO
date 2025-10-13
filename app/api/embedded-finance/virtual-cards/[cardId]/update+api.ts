import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

export async function PATCH(request: Request, { params }: { params: { cardId: string } }) {
  try {
    const { cardId } = params;
    const body = await request.json();
    const { status, spendingLimits, allowedCategories, blockedCategories } = body;

    if (!cardId) {
      return new Response(
        JSON.stringify({ error: 'Card ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Prepare update parameters
    const updateParams: any = {};

    // Update card status (active, inactive, canceled)
    if (status && ['active', 'inactive', 'canceled'].includes(status)) {
      updateParams.status = status;
    }

    // Update spending controls
    if (spendingLimits || allowedCategories || blockedCategories) {
      updateParams.spending_controls = {};

      if (spendingLimits && Array.isArray(spendingLimits)) {
        updateParams.spending_controls.spending_limits = spendingLimits.map((limit: any) => ({
          amount: limit.amount * 100, // Convert to cents
          interval: limit.interval, // 'per_authorization', 'daily', 'weekly', 'monthly', 'yearly', 'all_time'
        }));
      }

      if (allowedCategories && Array.isArray(allowedCategories)) {
        updateParams.spending_controls.allowed_categories = allowedCategories;
      }

      if (blockedCategories && Array.isArray(blockedCategories)) {
        updateParams.spending_controls.blocked_categories = blockedCategories;
      }
    }

    // Update the card in Stripe
    const updatedCard = await stripe.issuing.cards.update(cardId, updateParams);

    // Return sanitized response
    const sanitizedCard = {
      id: updatedCard.id,
      status: updatedCard.status,
      spending_controls: updatedCard.spending_controls,
      last4: updatedCard.last4,
      metadata: updatedCard.metadata,
      updated: Date.now(),
    };

    return Response.json({
      success: true,
      card: sanitizedCard,
      message: 'Card updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating card:', error);
    
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
      JSON.stringify({ error: 'Failed to update card' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}