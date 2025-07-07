export interface SubscriptionUsageData {
  subscriptionId: string;
  lastUsed: Date | null;
  usageFrequency: 'daily' | 'weekly' | 'monthly' | 'rarely' | 'never';
  averageSessionDuration: number; // minutes
  totalUsageThisMonth: number; // minutes
  costPerHour: number;
  valueScore: number; // 0-100
  trends: {
    period: 'week' | 'month' | 'quarter';
    usageChange: number; // percentage
    direction: 'increasing' | 'decreasing' | 'stable';
  };
}

export interface AIRecommendation {
  id: string;
  subscriptionId: string;
  type: 'optimize' | 'downgrade' | 'pause' | 'cancel' | 'switch_plan' | 'bundle_opportunity';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  potentialSavings: number;
  confidence: number; // 0-100
  reasoning: string[];
  actionRequired: string;
  deadline?: Date;
  alternativeOptions?: {
    planName: string;
    cost: number;
    savings: number;
    features: string[];
  }[];
}

export interface SubscriptionInsight {
  type: 'overspending' | 'underutilized' | 'good_value' | 'expiring_soon' | 'price_increase' | 'better_alternative';
  severity: 'info' | 'warning' | 'alert' | 'critical';
  title: string;
  message: string;
  subscriptionIds: string[];
  actionable: boolean;
  estimatedImpact: number;
}

export interface NotificationPreference {
  type: 'renewal_reminder' | 'usage_alert' | 'savings_opportunity' | 'price_change' | 'optimization_tip';
  enabled: boolean;
  timing: number; // days before for reminders
  threshold?: number; // for usage-based alerts
}

export interface AIAssistantConfig {
  analysisFrequency: 'daily' | 'weekly' | 'monthly';
  minUsageThreshold: number; // days without usage before alert
  savingsThreshold: number; // minimum savings to recommend
  confidenceThreshold: number; // minimum confidence for recommendations
  notifications: NotificationPreference[];
}
