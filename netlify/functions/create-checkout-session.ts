import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

interface NetlifyHandlerEvent {
  httpMethod: string;
  headers: Record<string, string | undefined>;
  body: string | null;
}

interface NetlifyHandlerResponse {
  statusCode: number;
  headers?: Record<string, string | undefined>;
  body: string;
}

type NetlifyHandler = (event: NetlifyHandlerEvent) => Promise<NetlifyHandlerResponse>;

export const handler: NetlifyHandler = async (event) => {
  // Handle preflight CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    if (event.httpMethod === 'GET' || event.httpMethod === 'HEAD') {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
        body: JSON.stringify({ status: 'ok', uptime: process.uptime?.() ?? null, timestamp: new Date().toISOString() }),
      };
    }
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const origin = process.env.SITE_URL || (event.headers.origin ?? 'https://subtrack-pro.lanonasis.com');
    const body = JSON.parse(event.body || '{}') as {
      userId?: string;
      email?: string;
      plan?: string
    };

    if (!body?.userId || !body?.email) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing userId or email' })
      };
    }

    if (!process.env.STRIPE_PRICE_PRO_MONTH) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Missing STRIPE_PRICE_PRO_MONTH environment variable' }),
      };
    }
    const price = process.env.STRIPE_PRICE_PRO_MONTH;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      allow_promotion_codes: true,
      line_items: [{ price, quantity: 1 }],
      customer_email: body.email,
      success_url: `${origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/billing/cancel`,
      subscription_data: {
        metadata: {
          user_id: body.userId,
          plan: body.plan ?? 'pro'
        },
      },
      metadata: {
        user_id: body.userId,
        plan: body.plan ?? 'pro'
      },
    });

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url: session.url }),
    };
  } catch (e: any) {
    console.error('Stripe Checkout Error:', e);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: e.message ?? 'Internal server error' })
    };
  }
};

export default handler;
