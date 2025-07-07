import { SubscriptionUsageData, AIRecommendation, SubscriptionInsight, AIAssistantConfig } from '@/types/aiAssistant';

interface SubscriptionData {
  id: string;
  name: string;
  cost: number;
  plan: string;
  category: string;
  nextBilling: string;
  status: string;
}

class AIAssistantService {
  private config: AIAssistantConfig = {
    analysisFrequency: 'weekly',
    minUsageThreshold: 30, // 30 days without usage
    savingsThreshold: 5, // $5 minimum savings
    confidenceThreshold: 70, // 70% confidence minimum
    notifications: [
      { type: 'renewal_reminder', enabled: true, timing: 3 },
      { type: 'usage_alert', enabled: true, timing: 30, threshold: 0 },
      { type: 'savings_opportunity', enabled: true, timing: 7 },
      { type: 'price_change', enabled: true, timing: 14 },
      { type: 'optimization_tip', enabled: true, timing: 7 },
    ],
  };

  /**
   * Analyze all user subscriptions and generate AI-powered insights
   */
  async analyzeSubscriptions(
    subscriptions: SubscriptionData[],
    usageData: SubscriptionUsageData[],
    userId: string
  ): Promise<{
    recommendations: AIRecommendation[];
    insights: SubscriptionInsight[];
    monthlyOptimization: number;
    yearlyOptimization: number;
  }> {
    const recommendations: AIRecommendation[] = [];
    const insights: SubscriptionInsight[] = [];

    // Analyze each subscription
    for (const subscription of subscriptions) {
      const usage = usageData.find(u => u.subscriptionId === subscription.id);
      
      if (usage) {
        // Check for underutilized subscriptions
        const underutilizedRecommendations = this.analyzeUnderutilizedSubscriptions(subscription, usage);
        recommendations.push(...underutilizedRecommendations);

        // Check for optimization opportunities
        const optimizationRecommendations = this.analyzeOptimizationOpportunities(subscription, usage);
        recommendations.push(...optimizationRecommendations);

        // Generate insights
        const subscriptionInsights = this.generateSubscriptionInsights(subscription, usage);
        insights.push(...subscriptionInsights);
      }
    }

    // Analyze spending patterns across all subscriptions
    const spendingInsights = this.analyzeSpendingPatterns(subscriptions, usageData);
    insights.push(...spendingInsights);

    // Bundle opportunity analysis
    const bundleRecommendations = this.analyzeBundleOpportunities(subscriptions);
    recommendations.push(...bundleRecommendations);

    // Calculate potential savings
    const monthlyOptimization = recommendations.reduce((sum, rec) => sum + rec.potentialSavings, 0);
    const yearlyOptimization = monthlyOptimization * 12;

    // Sort recommendations by priority and potential savings
    recommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }
      return b.potentialSavings - a.potentialSavings;
    });

    return {
      recommendations: recommendations.slice(0, 10), // Top 10 recommendations
      insights,
      monthlyOptimization,
      yearlyOptimization,
    };
  }

  /**
   * Analyze underutilized subscriptions
   */
  private analyzeUnderutilizedSubscriptions(
    subscription: SubscriptionData,
    usage: SubscriptionUsageData
  ): AIRecommendation[] {
    const recommendations: AIRecommendation[] = [];
    const daysSinceLastUse = usage.lastUsed 
      ? Math.floor((new Date().getTime() - usage.lastUsed.getTime()) / (1000 * 60 * 60 * 24))
      : 365; // Assume never used if no data

    // Subscription not used for 30+ days
    if (daysSinceLastUse >= 30) {
      const confidence = Math.min(95, 60 + (daysSinceLastUse - 30) * 2);
      
      if (daysSinceLastUse >= 45) {
        // Recommend cancellation
        recommendations.push({
          id: `cancel_${subscription.id}`,
          subscriptionId: subscription.id,
          type: 'cancel',
          priority: 'high',
          title: `Cancel ${subscription.name}`,
          description: `You haven't used ${subscription.name} in ${daysSinceLastUse} days`,
          potentialSavings: subscription.cost,
          confidence,
          reasoning: [
            `No usage detected for ${daysSinceLastUse} days`,
            `Monthly cost: $${subscription.cost}`,
            `Potential annual savings: $${(subscription.cost * 12).toFixed(2)}`,
          ],
          actionRequired: 'Cancel subscription to stop recurring charges',
          deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        });
      } else {
        // Recommend pausing
        recommendations.push({
          id: `pause_${subscription.id}`,
          subscriptionId: subscription.id,
          type: 'pause',
          priority: 'medium',
          title: `Consider pausing ${subscription.name}`,
          description: `Low usage detected - ${daysSinceLastUse} days since last use`,
          potentialSavings: subscription.cost,
          confidence: confidence - 15,
          reasoning: [
            `Only ${usage.totalUsageThisMonth} minutes of usage this month`,
            `Cost per hour: $${usage.costPerHour.toFixed(2)}`,
            `Consider pausing until needed again`,
          ],
          actionRequired: 'Pause subscription temporarily',
        });
      }
    }

    // Low value score (poor cost-to-usage ratio)
    if (usage.valueScore < 30) {
      recommendations.push({
        id: `optimize_${subscription.id}`,
        subscriptionId: subscription.id,
        type: 'optimize',
        priority: 'medium',
        title: `Optimize ${subscription.name} usage`,
        description: `Low value score (${usage.valueScore}/100) - paying $${usage.costPerHour.toFixed(2)} per hour`,
        potentialSavings: subscription.cost * 0.3, // Assume 30% savings possible
        confidence: 75,
        reasoning: [
          `Current value score: ${usage.valueScore}/100`,
          `High cost per usage hour: $${usage.costPerHour.toFixed(2)}`,
          `Consider downgrading plan or finding alternatives`,
        ],
        actionRequired: 'Review plan options or usage patterns',
      });
    }

    return recommendations;
  }

  /**
   * Analyze optimization opportunities (plan changes, yearly vs monthly)
   */
  private analyzeOptimizationOpportunities(
    subscription: SubscriptionData,
    usage: SubscriptionUsageData
  ): AIRecommendation[] {
    const recommendations: AIRecommendation[] = [];

    // High usage - recommend yearly plan for savings
    if (usage.usageFrequency === 'daily' || usage.totalUsageThisMonth > 1000) {
      const yearlyDiscount = 0.2; // Assume 20% yearly discount
      const yearlySavings = subscription.cost * 12 * yearlyDiscount;
      
      recommendations.push({
        id: `yearly_${subscription.id}`,
        subscriptionId: subscription.id,
        type: 'switch_plan',
        priority: 'medium',
        title: `Switch ${subscription.name} to yearly billing`,
        description: `Save ${(yearlyDiscount * 100).toFixed(0)}% with annual subscription`,
        potentialSavings: yearlySavings / 12, // Monthly savings
        confidence: 85,
        reasoning: [
          `High usage detected: ${usage.totalUsageThisMonth} minutes this month`,
          `Yearly plans typically offer 15-25% discounts`,
          `Estimated annual savings: $${yearlySavings.toFixed(2)}`,
        ],
        actionRequired: 'Switch to annual billing cycle',
        alternativeOptions: [
          {
            planName: `${subscription.plan} (Annual)`,
            cost: subscription.cost * 0.8,
            savings: subscription.cost * 0.2,
            features: ['Same features', '20% discount', 'Annual billing'],
          },
        ],
      });
    }

    // Bundle opportunities with related services
    if (subscription.category === 'streaming' || subscription.category === 'productivity') {
      recommendations.push({
        id: `bundle_${subscription.id}`,
        subscriptionId: subscription.id,
        type: 'bundle_opportunity',
        priority: 'low',
        title: `Bundle opportunity for ${subscription.name}`,
        description: `Potential savings by bundling with related services`,
        potentialSavings: subscription.cost * 0.15, // 15% estimated savings
        confidence: 60,
        reasoning: [
          `${subscription.category} services often offer bundle discounts`,
          `Check for family plans or multi-service packages`,
          `Potential 10-25% savings with bundles`,
        ],
        actionRequired: 'Research bundle options',
      });
    }

    return recommendations;
  }

  /**
   * Generate insights about subscription patterns
   */
  private generateSubscriptionInsights(
    subscription: SubscriptionData,
    usage: SubscriptionUsageData
  ): SubscriptionInsight[] {
    const insights: SubscriptionInsight[] = [];

    // Price per value analysis
    if (usage.costPerHour > 10) {
      insights.push({
        type: 'overspending',
        severity: 'warning',
        title: 'High cost per usage',
        message: `${subscription.name} costs $${usage.costPerHour.toFixed(2)} per hour of usage`,
        subscriptionIds: [subscription.id],
        actionable: true,
        estimatedImpact: subscription.cost * 0.3,
      });
    } else if (usage.costPerHour < 1 && usage.valueScore > 80) {
      insights.push({
        type: 'good_value',
        severity: 'info',
        title: 'Excellent value',
        message: `${subscription.name} offers great value at $${usage.costPerHour.toFixed(2)} per hour`,
        subscriptionIds: [subscription.id],
        actionable: false,
        estimatedImpact: 0,
      });
    }

    // Usage trend analysis
    if (usage.trends.direction === 'decreasing' && Math.abs(usage.trends.usageChange) > 50) {
      insights.push({
        type: 'underutilized',
        severity: 'alert',
        title: 'Declining usage detected',
        message: `${subscription.name} usage decreased by ${Math.abs(usage.trends.usageChange)}% this ${usage.trends.period}`,
        subscriptionIds: [subscription.id],
        actionable: true,
        estimatedImpact: subscription.cost,
      });
    }

    return insights;
  }

  /**
   * Analyze spending patterns across all subscriptions
   */
  private analyzeSpendingPatterns(
    subscriptions: SubscriptionData[],
    usageData: SubscriptionUsageData[]
  ): SubscriptionInsight[] {
    const insights: SubscriptionInsight[] = [];
    const totalSpending = subscriptions.reduce((sum, sub) => sum + sub.cost, 0);
    
    // Category spending analysis
    const categorySpending = subscriptions.reduce((acc, sub) => {
      acc[sub.category] = (acc[sub.category] || 0) + sub.cost;
      return acc;
    }, {} as Record<string, number>);

    // Alert if any category is >40% of total spending
    Object.entries(categorySpending).forEach(([category, amount]) => {
      const percentage = (amount / totalSpending) * 100;
      if (percentage > 40) {
        insights.push({
          type: 'overspending',
          severity: 'warning',
          title: `High ${category} spending`,
          message: `${category} subscriptions account for ${percentage.toFixed(1)}% of your total spending ($${amount.toFixed(2)})`,
          subscriptionIds: subscriptions.filter(s => s.category === category).map(s => s.id),
          actionable: true,
          estimatedImpact: amount * 0.2,
        });
      }
    });

    return insights;
  }

  /**
   * Analyze bundle opportunities
   */
  private analyzeBundleOpportunities(subscriptions: SubscriptionData[]): AIRecommendation[] {
    const recommendations: AIRecommendation[] = [];

    // Group by category
    const categories = subscriptions.reduce((acc, sub) => {
      if (!acc[sub.category]) acc[sub.category] = [];
      acc[sub.category].push(sub);
      return acc;
    }, {} as Record<string, SubscriptionData[]>);

    // Check for bundle opportunities in each category
    Object.entries(categories).forEach(([category, subs]) => {
      if (subs.length >= 2) {
        const totalCost = subs.reduce((sum, sub) => sum + sub.cost, 0);
        const estimatedBundleSavings = totalCost * 0.2; // 20% bundle discount

        recommendations.push({
          id: `bundle_${category}`,
          subscriptionId: subs[0].id,
          type: 'bundle_opportunity',
          priority: 'low',
          title: `Bundle ${category} services`,
          description: `Combine ${subs.length} ${category} subscriptions for potential savings`,
          potentialSavings: estimatedBundleSavings,
          confidence: 65,
          reasoning: [
            `${subs.length} separate ${category} subscriptions`,
            `Current total: $${totalCost.toFixed(2)}/month`,
            `Bundles typically offer 15-25% discounts`,
          ],
          actionRequired: `Research ${category} bundle packages`,
        });
      }
    });

    return recommendations;
  }

  /**
   * Get real-time notifications about subscriptions
   */
  async getActiveNotifications(userId: string): Promise<{
    renewalReminders: Array<{ subscriptionId: string; daysUntilRenewal: number; }>;
    usageAlerts: Array<{ subscriptionId: string; daysSinceLastUse: number; }>;
    savingsOpportunities: AIRecommendation[];
  }> {
    // This would integrate with real notification system
    return {
      renewalReminders: [], // Populated by notification service
      usageAlerts: [], // Populated by usage monitoring
      savingsOpportunities: [], // Top recommendations
    };
  }

  /**
   * Update AI assistant configuration
   */
  async updateConfig(userId: string, config: Partial<AIAssistantConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
    // In production, save to user preferences
  }

  /**
   * Mock usage data generator for demo purposes
   * Enhanced with category-based realistic usage patterns
   */
  generateMockUsageData(subscriptions: SubscriptionData[]): SubscriptionUsageData[] {
    return subscriptions.map(sub => {
      // Generate realistic mock data based on subscription type
      let baseUsage = 60; // minutes per month
      let frequency: 'daily' | 'weekly' | 'monthly' | 'rarely' | 'never' = 'weekly';
      let daysSinceLastUse = 5;

      // Adjust based on category for more realistic simulation
      switch (sub.category) {
        case 'streaming':
          baseUsage = 300 + Math.random() * 200; // 5-8 hours
          frequency = 'daily';
          daysSinceLastUse = Math.random() > 0.8 ? 30 + Math.floor(Math.random() * 15) : Math.floor(Math.random() * 7);
          break;
        case 'productivity':
          baseUsage = 120 + Math.random() * 180; // 2-5 hours
          frequency = 'daily';
          daysSinceLastUse = Math.floor(Math.random() * 3);
          break;
        case 'creative':
          baseUsage = 180 + Math.random() * 120; // 3-5 hours
          frequency = Math.random() > 0.5 ? 'weekly' : 'daily';
          daysSinceLastUse = Math.random() > 0.7 ? 45 + Math.floor(Math.random() * 30) : Math.floor(Math.random() * 14);
          break;
        default:
          baseUsage = 60 + Math.random() * 120;
          frequency = Math.random() > 0.6 ? 'monthly' : 'weekly';
          daysSinceLastUse = Math.floor(Math.random() * 30);
      }

      const lastUsed = daysSinceLastUse > 0 ? 
        new Date(Date.now() - daysSinceLastUse * 24 * 60 * 60 * 1000) : 
        new Date();
        
      const totalUsage = baseUsage + Math.floor((Math.random() - 0.5) * 60);
      const costPerHour = totalUsage > 0 ? (sub.cost / (totalUsage / 60)) : sub.cost;
      const valueScore = Math.max(10, Math.min(95, 
        100 - (costPerHour * 5) + (totalUsage / 20) - (daysSinceLastUse * 2)
      ));
      
      return {
        subscriptionId: sub.id,
        lastUsed,
        usageFrequency: frequency,
        averageSessionDuration: Math.floor(totalUsage / 10) + Math.random() * 30,
        totalUsageThisMonth: totalUsage,
        costPerHour,
        valueScore,
        trends: {
          period: 'month',
          usageChange: Math.floor((Math.random() - 0.5) * 40),
          direction: Math.random() > 0.5 ? 'increasing' : 'decreasing',
        },
      };
    });
  }
}

export const aiAssistantService = new AIAssistantService();
