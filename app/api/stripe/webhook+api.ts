import Stripe from 'stripe';
import { databaseService } from '@/services/database';

// Initialize Stripe with your secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-06-30.basil',
});

// Webhook handler functions that maintain privacy/security model
// These only handle metadata updates, no sensitive data exposure

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  console.log('Processing subscription created:', subscription.id);
  
  try {
    // Get customer info safely
    const customerId = subscription.customer as string;
    const customer = await stripe.customers.retrieve(customerId);
    
    if (customer.deleted) return;
    
    // Get user ID from customer metadata or find by customer ID
    let userId = customer.metadata?.user_id;
    if (!userId) {
      const foundUserId = await databaseService.findUserByStripeCustomerId(customerId);
      if (!foundUserId) {
        console.error('No user ID found for subscription:', subscription.id);
        return;
      }
      userId = foundUserId;
    }

    // Extract plan name from subscription
    const planName = subscription.items.data[0]?.price?.nickname || 'Pro';
    
    // Update user's subscription tier in database
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
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log('Processing subscription updated:', subscription.id);
  
  try {
    // Get customer info safely
    const customerId = subscription.customer as string;
    const customer = await stripe.customers.retrieve(customerId);
    
    if (customer.deleted) return;
    
    // Get user ID from customer metadata or find by customer ID
    let userId = customer.metadata?.user_id;
    if (!userId) {
      const foundUserId = await databaseService.findUserByStripeCustomerId(customerId);
      if (!foundUserId) {
        console.error('No user ID found for subscription update:', subscription.id);
        return;
      }
      userId = foundUserId;
    }

    // Extract plan name from subscription
    const planName = subscription.items.data[0]?.price?.nickname || 'Pro';
    
    // Update user's subscription tier in database
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
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log('Processing subscription deleted:', subscription.id);
  
  try {
    const customerId = subscription.customer as string;
    const customer = await stripe.customers.retrieve(customerId);
    
    if (customer.deleted) return;
    
    // Get user ID from customer metadata or find by customer ID
    let userId = customer.metadata?.user_id;
    if (!userId) {
      const foundUserId = await databaseService.findUserByStripeCustomerId(customerId);
      if (!foundUserId) {
        console.error('No user ID found for subscription deletion:', subscription.id);
        return;
      }
      userId = foundUserId;
    }

    // Downgrade user to free tier
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
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  console.log('Processing payment succeeded:', invoice.id);
  
  try {
    // Invoice.subscription is nullable and can be string or Subscription object
    const subscriptionId = (invoice as any).subscription;
    const customerId = invoice.customer as string;
    
    if (!customerId) return;

    // Get customer to find user
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) return;

    // Get user ID from customer metadata or find by customer ID
    let userId = customer.metadata?.user_id;
    if (!userId) {
      const foundUserId = await databaseService.findUserByStripeCustomerId(customerId);
      if (!foundUserId) {
        console.error('No user ID found for payment:', invoice.id);
        return;
      }
      userId = foundUserId;
    }

    // Store payment record
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
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  console.log('Processing payment failed:', invoice.id);
  
  try {
    // Invoice.subscription is nullable and can be string or Subscription object
    const subscriptionId = (invoice as any).subscription;
    const customerId = invoice.customer as string;
    
    if (!customerId) return;

    // Get customer to find user
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) return;

    // Get user ID from customer metadata or find by customer ID
    let userId = customer.metadata?.user_id;
    if (!userId) {
      const foundUserId = await databaseService.findUserByStripeCustomerId(customerId);
      if (!foundUserId) {
        console.error('No user ID found for failed payment:', invoice.id);
        return;
      }
      userId = foundUserId;
    }

    // Store failed payment record
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
}

async function handleCardCreated(card: Stripe.Issuing.Card) {
  console.log('Processing virtual card created:', card.id);
  
  try {
    // Get user ID from card metadata
    const userId = card.metadata?.user_id;
    if (!userId) {
      console.error('No user ID found in card metadata:', card.id);
      return;
    }

    // Store only non-sensitive card metadata
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
}

async function handleCardAuthorization(authorization: Stripe.Issuing.Authorization) {
  console.log('Processing card authorization:', authorization.id);
  
  try {
    // Store authorization for spending tracking
    const success = await databaseService.storeCardAuthorization({
      authorization_id: authorization.id,
      card_id: authorization.card.id,
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
}

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return new Response('Missing stripe-signature header', { status: 400 });
    }

    // Verify the webhook signature
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!endpointSecret) {
      console.error('STRIPE_WEBHOOK_SECRET not configured');
      return new Response('Webhook secret not configured', { status: 500 });
    }
    
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, endpointSecret);
    } catch (err: any) {
      console.log(`Webhook signature verification failed:`, err.message);
      return new Response('Webhook signature verification failed', { status: 400 });
    }
    
    console.log('Received Stripe webhook:', event.type);

    // Handle subscription events
    switch (event.type) {
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;
      
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
      
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      // Virtual card events
      case 'issuing_card.created':
        await handleCardCreated(event.data.object as Stripe.Issuing.Card);
        break;

      case 'issuing_authorization.created':
        await handleCardAuthorization(event.data.object as Stripe.Issuing.Authorization);
        break;
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: 'Webhook processing failed' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}