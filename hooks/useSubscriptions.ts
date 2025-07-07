import { useQuery } from '@tanstack/react-query';
import { mockSubscriptions } from '@/data/mockData';
import { Subscription } from '@/types/subscription';

// Simulate API call with delay
const fetchSubscriptions = async (): Promise<Subscription[]> => {
  await new Promise(resolve => setTimeout(resolve, 800));
  return mockSubscriptions;
};

export const useSubscriptions = () => {
  return useQuery({
    queryKey: ['subscriptions'],
    queryFn: fetchSubscriptions,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

export const useActiveSubscriptions = () => {
  const { data: subscriptions, ...rest } = useSubscriptions();
  
  const activeSubscriptions = subscriptions?.filter(sub => sub.status === 'Active') || [];
  
  return {
    data: activeSubscriptions,
    ...rest,
  };
};