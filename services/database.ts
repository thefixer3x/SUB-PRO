import { createClient } from '@supabase/supabase-js';
import { Database } from '@/lib/supabase';

// Server-side database service for webhook handlers
// This maintains the existing security model by only accessing server-side environment variables

class DatabaseService {
  private supabase;

  constructor() {
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing Supabase environment variables for server-side access');
    }

    // Use service role key for server-side operations
    this.supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  // Update user's subscription tier based on Stripe subscription
  async updateUserSubscriptionTier(userId: string, stripeSubscriptionId: string, status: string, planName: string) {
    try {
      console.log('Updating user subscription tier:', { userId, stripeSubscriptionId, status, planName });

      // Determine subscription tier from plan name
      let tier: 'free' | 'pro' | 'team' = 'free';
      if (planName.toLowerCase().includes('pro') || planName.toLowerCase().includes('premium')) {
        tier = 'pro';
      } else if (planName.toLowerCase().includes('team')) {
        tier = 'team';
      }

      // Only update if subscription is active
      if (status === 'active') {
        const { data, error } = await this.supabase
          .from('profiles')
          .update({ 
            subscription_tier: tier,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId);

        if (error) {
          console.error('Error updating user subscription tier:', error);
          return false;
        }

        console.log('Successfully updated user subscription tier:', data);
        return true;
      } else if (status === 'canceled' || status === 'unpaid') {
        // Downgrade to free tier
        const { data, error } = await this.supabase
          .from('profiles')
          .update({ 
            subscription_tier: 'free',
            updated_at: new Date().toISOString()
          })
          .eq('id', userId);

        if (error) {
          console.error('Error downgrading user to free tier:', error);
          return false;
        }

        console.log('Successfully downgraded user to free tier:', data);
        return true;
      }

      return true;
    } catch (error) {
      console.error('Database error updating subscription tier:', error);
      return false;
    }
  }

  // Store virtual card reference (non-sensitive data only)
  async storeVirtualCardReference(userId: string, cardData: {
    stripe_card_id: string;
    last4: string;
    brand: string;
    status: string;
    subscription_id?: string;
  }) {
    try {
      console.log('Storing virtual card reference:', { userId, cardId: cardData.stripe_card_id });

      // Check if the table exists first, create if needed
      const { data, error } = await this.supabase.rpc('create_virtual_cards_table_if_not_exists');
      if (error) {
        console.log('Table creation check result:', error.message);
      }

      // Store only non-sensitive card metadata
      const { data: cardRef, error: cardError } = await this.supabase
        .from('virtual_cards')
        .insert({
          user_id: userId,
          stripe_card_id: cardData.stripe_card_id,
          last4: cardData.last4,
          brand: cardData.brand,
          status: cardData.status,
          subscription_id: cardData.subscription_id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (cardError) {
        console.error('Error storing virtual card reference:', cardError);
        return false;
      }

      console.log('Successfully stored virtual card reference:', cardRef);
      return true;
    } catch (error) {
      console.error('Database error storing virtual card:', error);
      return false;
    }
  }

  // Store card authorization for spending tracking (non-sensitive data only)
  async storeCardAuthorization(authData: {
    authorization_id: string;
    card_id: string;
    amount: number;
    currency: string;
    merchant_data: any;
    approved: boolean;
    created: Date;
  }) {
    try {
      console.log('Storing card authorization:', { authId: authData.authorization_id, amount: authData.amount });

      // Store authorization for spending tracking
      const { data, error } = await this.supabase
        .from('card_authorizations')
        .insert({
          stripe_authorization_id: authData.authorization_id,
          stripe_card_id: authData.card_id,
          amount: authData.amount,
          currency: authData.currency,
          merchant_name: authData.merchant_data?.name || 'Unknown',
          merchant_category: authData.merchant_data?.category || 'general',
          approved: authData.approved,
          transaction_date: authData.created.toISOString(),
          created_at: new Date().toISOString(),
        });

      if (error) {
        console.error('Error storing card authorization:', error);
        return false;
      }

      console.log('Successfully stored card authorization:', data);
      return true;
    } catch (error) {
      console.error('Database error storing authorization:', error);
      return false;
    }
  }

  // Find user by Stripe customer ID
  async findUserByStripeCustomerId(stripeCustomerId: string): Promise<string | null> {
    try {
      // Look for user with this stripe customer ID in metadata or profile
      const { data, error } = await this.supabase
        .from('profiles')
        .select('id')
        .eq('stripe_customer_id', stripeCustomerId)
        .single();

      if (error || !data) {
        console.log('User not found by stripe customer ID:', stripeCustomerId);
        return null;
      }

      return data.id;
    } catch (error) {
      console.error('Error finding user by Stripe customer ID:', error);
      return null;
    }
  }

  // Store payment record for tracking
  async storePaymentRecord(paymentData: {
    user_id: string;
    stripe_payment_intent_id?: string;
    stripe_invoice_id?: string;
    amount: number;
    currency: string;
    status: 'succeeded' | 'failed' | 'pending';
    subscription_id?: string;
  }) {
    try {
      console.log('Storing payment record:', { 
        userId: paymentData.user_id, 
        amount: paymentData.amount, 
        status: paymentData.status 
      });

      const { data, error } = await this.supabase
        .from('payment_records')
        .insert({
          ...paymentData,
          created_at: new Date().toISOString(),
        });

      if (error) {
        console.error('Error storing payment record:', error);
        return false;
      }

      console.log('Successfully stored payment record:', data);
      return true;
    } catch (error) {
      console.error('Database error storing payment:', error);
      return false;
    }
  }
}

// Export singleton instance
export const databaseService = new DatabaseService();
