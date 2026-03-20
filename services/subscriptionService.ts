import { supabase, isSupabaseEnvConfigured } from '@/lib/supabase';
import type { Database } from '@/lib/supabase';
import type { Subscription } from '@/types/subscription';

type SubscriptionRow = Database['public']['Tables']['subscriptions']['Row'];
type SubscriptionInsert = Database['public']['Tables']['subscriptions']['Insert'];
type SubscriptionUpdate = Database['public']['Tables']['subscriptions']['Update'];

const SUBSCRIPTIONS_TABLE: keyof Database['public']['Tables'] = 'subscriptions';

/** Map DB row (snake_case) to client model (camelCase). */
function toSubscription(row: SubscriptionRow): Subscription {
  return {
    id: row.id,
    name: row.name,
    category: row.category as Subscription['category'],
    status: row.status as Subscription['status'],
    planName: row.plan_name,
    monthlyCost: Number(row.monthly_cost),
    currency: row.currency,
    billingCycle: row.billing_cycle as Subscription['billingCycle'],
    renewalDate: new Date(row.renewal_date),
    paymentMethod: row.payment_method,
    notes: row.notes ?? undefined,
    lastUsed: row.last_used ? new Date(row.last_used) : undefined,
    priority: row.priority as Subscription['priority'],
    deactivationDate: row.deactivation_date ? new Date(row.deactivation_date) : undefined,
    logoUrl: row.logo_url ?? undefined,
    color: row.color ?? undefined,
  };
}

/** Map client model to DB insert row. */
function toInsertRow(sub: Omit<Subscription, 'id'>, userId: string): SubscriptionInsert {
  return {
    user_id: userId,
    name: sub.name,
    category: sub.category,
    status: sub.status,
    plan_name: sub.planName,
    monthly_cost: sub.monthlyCost,
    currency: sub.currency,
    billing_cycle: sub.billingCycle,
    renewal_date: sub.renewalDate.toISOString(),
    payment_method: sub.paymentMethod,
    notes: sub.notes ?? null,
    last_used: sub.lastUsed?.toISOString() ?? null,
    priority: sub.priority,
    deactivation_date: sub.deactivationDate?.toISOString() ?? null,
    logo_url: sub.logoUrl ?? null,
    color: sub.color ?? null,
  };
}

export async function fetchUserSubscriptions(userId: string): Promise<Subscription[]> {
  if (!isSupabaseEnvConfigured) {
    console.warn('Supabase not configured — returning empty subscriptions');
    return [];
  }

  const { data, error } = await supabase
    .from(SUBSCRIPTIONS_TABLE)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching subscriptions:', error);
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => toSubscription(row as SubscriptionRow));
}

export async function createSubscription(
  userId: string,
  sub: Omit<Subscription, 'id'>
): Promise<Subscription> {
  if (!isSupabaseEnvConfigured) {
    throw new Error('Supabase not configured');
  }

  const row = toInsertRow(sub, userId);

  const { data, error } = await (
    supabase.from(SUBSCRIPTIONS_TABLE) as unknown as {
      insert: (values: SubscriptionInsert) => {
        select: () => {
          single: () => Promise<{
            data: SubscriptionRow | null;
            error: { message: string } | null;
          }>;
        };
      };
    }
  )
    .insert(row)
    .select()
    .single();

  if (error) {
    console.error('Error creating subscription:', error);
    throw new Error(error.message);
  }

  return toSubscription(data as SubscriptionRow);
}

export async function updateSubscription(
  subscriptionId: string,
  updates: Partial<Subscription>
): Promise<Subscription> {
  if (!isSupabaseEnvConfigured) {
    throw new Error('Supabase not configured');
  }

  const dbUpdates: SubscriptionUpdate = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.category !== undefined) dbUpdates.category = updates.category;
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.planName !== undefined) dbUpdates.plan_name = updates.planName;
  if (updates.monthlyCost !== undefined) dbUpdates.monthly_cost = updates.monthlyCost;
  if (updates.currency !== undefined) dbUpdates.currency = updates.currency;
  if (updates.billingCycle !== undefined) dbUpdates.billing_cycle = updates.billingCycle;
  if (updates.renewalDate !== undefined) dbUpdates.renewal_date = updates.renewalDate.toISOString();
  if (updates.paymentMethod !== undefined) dbUpdates.payment_method = updates.paymentMethod;
  if (updates.notes !== undefined) dbUpdates.notes = updates.notes ?? null;
  if (updates.lastUsed !== undefined) dbUpdates.last_used = updates.lastUsed?.toISOString() ?? null;
  if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
  if (updates.deactivationDate !== undefined) dbUpdates.deactivation_date = updates.deactivationDate?.toISOString() ?? null;
  if (updates.logoUrl !== undefined) dbUpdates.logo_url = updates.logoUrl ?? null;
  if (updates.color !== undefined) dbUpdates.color = updates.color ?? null;

  const { data, error } = await (
    supabase.from(SUBSCRIPTIONS_TABLE) as unknown as {
      update: (values: SubscriptionUpdate) => {
        eq: (column: string, value: string) => {
          select: () => {
            single: () => Promise<{
              data: SubscriptionRow | null;
              error: { message: string } | null;
            }>;
          };
        };
      };
    }
  )
    .update(dbUpdates)
    .eq('id', subscriptionId)
    .select()
    .single();

  if (error) {
    console.error('Error updating subscription:', error);
    throw new Error(error.message);
  }

  return toSubscription(data as SubscriptionRow);
}

export async function deleteSubscription(subscriptionId: string): Promise<void> {
  if (!isSupabaseEnvConfigured) {
    throw new Error('Supabase not configured');
  }

  const { error } = await supabase
    .from(SUBSCRIPTIONS_TABLE)
    .delete()
    .eq('id', subscriptionId);

  if (error) {
    console.error('Error deleting subscription:', error);
    throw new Error(error.message);
  }
}
