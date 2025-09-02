import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

export async function POST(request: Request) {
  try {
    const { email, country = 'US', type = 'express', businessName, category } = await request.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create Express account for subscription provider
    const account = await stripe.accounts.create({
      type: type as 'express' | 'standard' | 'custom',
      country: country,
      email: email,
      business_type: 'company',
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_profile: {
        mcc: '5968', // Software and digital services
        product_description: 'Subscription management and digital services',
        name: businessName,
        support_email: email,
        url: `https://subtrack-pro.lanonasis.com/providers/${encodeURIComponent(businessName)}`,
      },
      metadata: {
        platform: 'subtrack_pro',
        category: category || 'general',
        created_via: 'connect_api',
      },
    });

    return Response.json({
      success: true,
      account_id: account.id,
      email: account.email,
      type: account.type,
      country: account.country,
      business_profile: account.business_profile,
      capabilities: account.capabilities,
      requirements: account.requirements,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
    });
  } catch (error: any) {
    console.error('Error creating connected account:', error);
    
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
      JSON.stringify({ error: 'Failed to create connected account' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}