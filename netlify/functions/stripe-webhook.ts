import Stripe from 'stripe';
import { databaseService } from '../../services/database';

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!stripeSecret) {
  console.warn('STRIPE_SECRET_KEY is not configured. Stripe webhook handler will not function correctly.');
}

if (!webhookSecret) {
  console.warn('STRIPE_WEBHOOK_SECRET is not configured. Stripe webhook handler will not verify signatures.');
}

const stripe = stripeSecret
  ? new Stripe(stripeSecret, {
      apiVersion: '2025-08-27.basil',
    })
  : undefined;

interface NetlifyEvent {
  httpMethod: string;
  headers: Record<string, string | undefined>;
  body: string | null;
  isBase64Encoded?: boolean;
}

interface NetlifyResult {
  statusCode: number;
  headers?: Record<string, string | undefined>;
  body: string;
}

const json = (statusCode: number, body: unknown): NetlifyResult => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(body),
});

const getRawBody = (event: NetlifyEvent): string => {
  if (!event.body) {
    return '';
  }
  if (event.isBase64Encoded) {
    return Buffer.from(event.body, 'base64').toString('utf8');
  }
  return event.body;
};

const handleSubscriptionCreated = async (subscription: Stripe.Subscription) => {
  console.log('Processing subscription created:', subscription.id);

  try {
    const client = ensureStripe();
    const customerId = subscription.customer as string;
    const customer = await client.customers.retrieve(customerId);

    if ((customer as Stripe.Customer).deleted) {
      return;
    }

    let userId = (customer as Stripe.Customer).metadata?.user_id;
    if (!userId) {
      const foundUserId = await databaseService.findUserByStripeCustomerId(customerId);
      if (!foundUserId) {
        console.error('No user ID found for subscription:', subscription.id);
        return;
      }
      userId = foundUserId;
    }

    const planName = subscription.items.data[0]?.price?.nickname || 'Pro';

    const success = await databaseService.updateUserSubscriptionTier(
      userId,
      subscription.id,
      subscription.status,
      planName
    );

    if (success) {
      console.log('Successfully processed subscription created for user:', userId);
    } else {
      console.error('Failed to update database for subscription:', subscription.id);
    }
  } catch (error) {
    console.error('Error handling subscription created:', error);
  }
};

const handleSubscriptionUpdated = async (subscription: Stripe.Subscription) => {
  console.log('Processing subscription updated:', subscription.id);

  try {
    const client = ensureStripe();
    const customerId = subscription.customer as string;
    const customer = await client.customers.retrieve(customerId);

    if ((customer as Stripe.Customer).deleted) {
      return;
    }

    let userId = (customer as Stripe.Customer).metadata?.user_id;
    if (!userId) {
      const foundUserId = await databaseService.findUserByStripeCustomerId(customerId);
      if (!foundUserId) {
        console.error('No user ID found for subscription update:', subscription.id);
        return;
      }
      userId = foundUserId;
    }

    const planName = subscription.items.data[0]?.price?.nickname || 'Pro';

    const success = await databaseService.updateUserSubscriptionTier(
      userId,
      subscription.id,
      subscription.status,
      planName
    );

    if (success) {
      console.log('Successfully processed subscription update for user:', userId);
    } else {
      console.error('Failed to update database for subscription:', subscription.id);
    }
  } catch (error) {
    console.error('Error handling subscription updated:', error);
  }
};

const handleSubscriptionDeleted = async (subscription: Stripe.Subscription) => {
  console.log('Processing subscription deleted:', subscription.id);

  try {
    const client = ensureStripe();
    const customerId = subscription.customer as string;
    const customer = await client.customers.retrieve(customerId);

    if ((customer as Stripe.Customer).deleted) {
      return;
    }

    let userId = (customer as Stripe.Customer).metadata?.user_id;
    if (!userId) {
      const foundUserId = await databaseService.findUserByStripeCustomerId(customerId);
      if (!foundUserId) {
        console.error('No user ID found for subscription deletion:', subscription.id);
        return;
      }
      userId = foundUserId;
    }

    const success = await databaseService.updateUserSubscriptionTier(
      userId,
      subscription.id,
      'canceled',
      'Free'
    );

    if (success) {
      console.log('Successfully downgraded user to free tier:', userId);
    } else {
      console.error('Failed to downgrade user for subscription:', subscription.id);
    }
  } catch (error) {
    console.error('Error handling subscription deleted:', error);
  }
};

const handlePaymentSucceeded = async (invoice: Stripe.Invoice) => {
  console.log('Processing payment succeeded:', invoice.id);

  try {
    const client = ensureStripe();
    const subscriptionId = (invoice as unknown as { subscription?: string }).subscription;
    const customerId = invoice.customer as string;

    if (!customerId) {
      return;
    }

    const customer = await client.customers.retrieve(customerId);
    if ((customer as Stripe.Customer).deleted) {
      return;
    }

    let userId = (customer as Stripe.Customer).metadata?.user_id;
    if (!userId) {
      const foundUserId = await databaseService.findUserByStripeCustomerId(customerId);
      if (!foundUserId) {
        console.error('No user ID found for payment:', invoice.id);
        return;
      }
      userId = foundUserId;
    }

    const success = await databaseService.storePaymentRecord({
      user_id: userId,
      stripe_invoice_id: invoice.id,
      amount: invoice.total || 0,
      currency: invoice.currency || 'usd',
      status: 'succeeded',
      subscription_id: subscriptionId,
    });

    if (success) {
      console.log('Successfully stored payment record for user:', userId);
    } else {
      console.error('Failed to store payment record for invoice:', invoice.id);
    }
  } catch (error) {
    console.error('Error handling payment succeeded:', error);
  }
};

const handlePaymentFailed = async (invoice: Stripe.Invoice) => {
  console.log('Processing payment failed:', invoice.id);

  try {
    const client = ensureStripe();
    const subscriptionId = (invoice as unknown as { subscription?: string }).subscription;
    const customerId = invoice.customer as string;

    if (!customerId) {
      return;
    }

    const customer = await client.customers.retrieve(customerId);
    if ((customer as Stripe.Customer).deleted) {
      return;
    }

    let userId = (customer as Stripe.Customer).metadata?.user_id;
    if (!userId) {
      const foundUserId = await databaseService.findUserByStripeCustomerId(customerId);
      if (!foundUserId) {
        console.error('No user ID found for failed payment:', invoice.id);
        return;
      }
      userId = foundUserId;
    }

    const success = await databaseService.storePaymentRecord({
      user_id: userId,
      stripe_invoice_id: invoice.id,
      amount: invoice.total || 0,
      currency: invoice.currency || 'usd',
      status: 'failed',
      subscription_id: subscriptionId,
    });

    if (success) {
      console.log('Successfully stored failed payment record for user:', userId);
    } else {
      console.error('Failed to store failed payment record for invoice:', invoice.id);
    }
  } catch (error) {
    console.error('Error handling payment failed:', error);
  }
};

const handleCardCreated = async (card: Stripe.Issuing.Card) => {
  console.log('Processing virtual card created:', card.id);

  try {
    const userId = card.metadata?.user_id;
    if (!userId) {
      console.error('No user ID found in card metadata:', card.id);
      return;
    }

    const success = await databaseService.storeVirtualCardReference(userId, {
      stripe_card_id: card.id,
      last4: card.last4,
      brand: card.brand,
      status: card.status,
      subscription_id: card.metadata?.subscription_id,
    });

    if (success) {
      console.log('Successfully stored virtual card reference for user:', userId);
    } else {
      console.error('Failed to store virtual card reference:', card.id);
    }
  } catch (error) {
    console.error('Error handling card created:', error);
  }
};

const handleCardAuthorization = async (authorization: Stripe.Issuing.Authorization) => {
  console.log('Processing card authorization:', authorization.id);

  try {
    const success = await databaseService.storeCardAuthorization({
      authorization_id: authorization.id,
      card_id: typeof authorization.card === 'string' ? authorization.card : authorization.card.id,
      amount: authorization.amount,
      currency: authorization.currency,
      merchant_data: authorization.merchant_data,
      approved: authorization.approved,
      created: new Date(authorization.created * 1000),
    });

    if (success) {
      console.log('Successfully stored card authorization:', authorization.id);
    } else {
      console.error('Failed to store card authorization:', authorization.id);
    }
  } catch (error) {
    console.error('Error handling card authorization:', error);
  }
};

const ensureStripe = () => {
  if (!stripe) {
    throw new Error('Stripe client is not configured.');
  }
  return stripe;
};

export const handler = async (event: NetlifyEvent): Promise<NetlifyResult> => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method Not Allowed' });
  }

  if (!stripe || !webhookSecret) {
    console.error('Stripe webhook configuration missing');
    return json(500, { error: 'Webhook configuration missing' });
  }

  const signature = event.headers['stripe-signature'];
  if (!signature) {
    return json(400, { error: 'Missing stripe-signature header' });
  }

  const rawBody = getRawBody(event);

  let stripeEvent: Stripe.Event;
  try {
    stripeEvent = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid payload';
    console.error('Webhook signature verification failed:', message);
    return json(400, { error: 'Webhook signature verification failed' });
  }

  console.log('Received Stripe webhook:', stripeEvent.type);

  try {
    switch (stripeEvent.type) {
      case 'customer.subscription.created':
        await handleSubscriptionCreated(stripeEvent.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(stripeEvent.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(stripeEvent.data.object as Stripe.Subscription);
        break;
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(stripeEvent.data.object as Stripe.Invoice);
        break;
      case 'invoice.payment_failed':
        await handlePaymentFailed(stripeEvent.data.object as Stripe.Invoice);
        break;
      case 'issuing_card.created':
        await handleCardCreated(stripeEvent.data.object as Stripe.Issuing.Card);
        break;
      case 'issuing_authorization.created':
        await handleCardAuthorization(stripeEvent.data.object as Stripe.Issuing.Authorization);
        break;
      default:
        console.log(`Unhandled event type: ${stripeEvent.type}`);
    }

    return json(200, { received: true });
  } catch (error) {
    console.error('Webhook processing failed:', error);
    return json(500, { error: 'Webhook processing failed' });
  }
};

export default handler;
