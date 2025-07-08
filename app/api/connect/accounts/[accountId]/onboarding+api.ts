import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-06-30.basil',
});

export async function POST(request: Request, { params }: { params: { accountId: string } }) {
  try {
    const { accountId } = params;
    const { refresh_url, return_url } = await request.json();

    if (!accountId) {
      return new Response(
        JSON.stringify({ error: 'Account ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refresh_url || `https://subtrack-pro.lanonasis.com/connect/refresh`,
      return_url: return_url || `https://subtrack-pro.lanonasis.com/connect/success`,
      type: 'account_onboarding',
    });

    return Response.json({
      success: true,
      onboarding_url: accountLink.url,
      expires_at: accountLink.expires_at,
      account_id: accountId,
    });
  } catch (error: any) {
    console.error('Error creating account link:', error);
    
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
      JSON.stringify({ error: 'Failed to create onboarding link' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}