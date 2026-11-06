import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/supabase';
import type { Subscription } from '@/types/subscription';

type SmSubRow = Database['public']['Tables']['sm_subscriptions']['Row'];

/** Map a DB row (snake_case) to the client Subscription model. */
function toSubscription(row: SmSubRow): Subscription {
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

const TABLE = 'sm_subscriptions';

/** Fetch all subscriptions for the given user_id. RLS enforces ownership. */
async function fetchSubscriptions(userId: string): Promise<Subscription[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(toSubscription);
}

// Real account ids are UUIDs. The demo/guest account uses a local id
// ("mock-user-…") that has no rows; querying with it makes Postgres reject the
// uuid cast (HTTP 400), which the screens showed as "Failed to load".
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const useSubscriptions = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['subscriptions', userId],
    queryFn: async (): Promise<Subscription[] | null> => {
      if (!userId) return null;
      // A non-account id (demo mode) has no subscriptions: show the empty state.
      if (!UUID_RE.test(userId)) return [];
      return fetchSubscriptions(userId);
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1,
  });
};

export const useActiveSubscriptions = (userId: string | undefined) => {
  const { data: subscriptions, ...rest } = useSubscriptions(userId);

  const activeSubscriptions = subscriptions?.filter(
    (sub) => sub.status === 'Active',
  ) || [];

  return {
    data: activeSubscriptions,
    ...rest,
  };
};

/** Invalidate the subscriptions query cache — call after mutations. */
export const useInvalidateSubscriptions = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
};