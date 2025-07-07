export interface Subscription {
  id: string;
  name: string;
  category: SubscriptionCategory;
  status: SubscriptionStatus;
  planName: string;
  monthlyCost: number;
  currency: string;
  billingCycle: BillingCycle;
  renewalDate: Date;
  paymentMethod: string;
  notes?: string;
  lastUsed?: Date;
  priority: Priority;
  deactivationDate?: Date;
  logoUrl?: string;
  color?: string;
}

export type SubscriptionCategory = 
  | 'Productivity' 
  | 'Entertainment' 
  | 'Creative' 
  | 'Finance' 
  | 'AI' 
  | 'Utilities' 
  | 'Health' 
  | 'Education' 
  | 'Communication'
  | 'Other';

export type SubscriptionStatus = 'Active' | 'Inactive' | 'Paused' | 'Trial' | 'Expired';

export type BillingCycle = 'Monthly' | 'Quarterly' | 'Annually' | 'Weekly';

export type Priority = 'High' | 'Medium' | 'Low';

export interface SpendingData {
  month: string;
  amount: number;
  subscriptions: number;
}

export interface CategorySpend {
  category: SubscriptionCategory;
  amount: number;
  percentage: number;
  color: string;
}

export interface DashboardWidget {
  id: string;
  type: 'spending-overview' | 'active-subscriptions' | 'upcoming-renewals' | 'category-breakdown' | 'spending-trend';
  title: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  enabled: boolean;
}