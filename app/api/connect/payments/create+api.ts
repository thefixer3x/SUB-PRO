import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-06-30.basil',
});

export async function POST(request: Request) {
  try {
    const { 
      amount, 
      currency = 'usd', 
      connected_account_id, 
      application_fee_amount,
      customer_id,
      payment_method_id,
      subscription_id,
      provider_name,
      user_id
    } = await request.json();

    // Validate required fields
    if (!amount || !connected_account_id) {
      return new Response(
        JSON.stringify({ error: 'Amount and connected account ID are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!application_fee_amount) {
      return new Response(
        JSON.stringify({ error: 'Application fee amount is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create payment intent with application fee
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: currency,
      customer: customer_id,
      payment_method: payment_method_id,
      application_fee_amount: Math.round(application_fee_amount * 100),
      transfer_data: {
        destination: connected_account_id,
      },
      confirm: payment_method_id ? true : false, // Auto-confirm if payment method provided
      automatic_payment_methods: payment_method_id ? undefined : {
        enabled: true,
      },
      metadata: {
        subscription_id: subscription_id || '',
        provider_name: provider_name || '',
        user_id: user_id || '',
        platform: 'subtrack_pro',
        payment_type: 'subscription_payment',
      },
    });

    return Response.json({
      success: true,
      payment_intent_id: paymentIntent.id,
      client_secret: paymentIntent.client_secret,
      status: paymentIntent.status,
      amount: amount,
      application_fee: application_fee_amount,
      provider_amount: amount - application_fee_amount,
      connected_account_id: connected_account_id,
    });
  } catch (error: any) {
    console.error('Error creating Connect payment:', error);
    
    if (error instanceof Stripe.errors.StripeError) {
      return new Response(
        JSON.stringify({ 
          error: 'Stripe error: ' + error.message,
          type: error.type,
          code: error.code,
        }),
        {
          status: error.statusCode || 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
    
    return new Response(
      JSON.stringify({ error: 'Failed to create payment' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}