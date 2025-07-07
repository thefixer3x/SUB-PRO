import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { 
  Bell, 
  AlertTriangle, 
  Calendar, 
  TrendingDown, 
  DollarSign,
  Clock,
  X,
  CheckCircle
} from 'lucide-react-native';
import { aiAssistantService } from '@/services/aiAssistant';

interface SmartNotification {
  id: string;
  type: 'renewal_reminder' | 'usage_alert' | 'savings_opportunity' | 'price_change' | 'optimization_tip';
  title: string;
  message: string;
  subscriptionId?: string;
  subscriptionName?: string;
  priority: 'high' | 'medium' | 'low';
  actionable: boolean;
  potentialSavings?: number;
  daysUntilEvent?: number;
  timestamp: Date;
}

interface SmartNotificationsProps {
  subscriptions: any[];
  userId: string;
  onNotificationAction?: (notificationId: string, action: string) => void;
}

export const SmartNotifications: React.FC<SmartNotificationsProps> = ({
  subscriptions,
  userId,
  onNotificationAction,
}) => {
  const [notifications, setNotifications] = useState<SmartNotification[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    generateSmartNotifications();
  }, [subscriptions]);

  const generateSmartNotifications = () => {
    const newNotifications: SmartNotification[] = [];

    subscriptions.forEach(subscription => {
      // Renewal reminders (3 days before billing)
      const nextBilling = new Date(subscription.nextBilling);
      const daysUntilBilling = Math.ceil((nextBilling.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysUntilBilling <= 3 && daysUntilBilling > 0) {
        newNotifications.push({
          id: `renewal_${subscription.id}`,
          type: 'renewal_reminder',
          title: `${subscription.name} renews ${daysUntilBilling === 1 ? 'tomorrow' : `in ${daysUntilBilling} days`}`,
          message: `$${subscription.cost} will be charged on ${nextBilling.toLocaleDateString()}`,
          subscriptionId: subscription.id,
          subscriptionName: subscription.name,
          priority: daysUntilBilling === 1 ? 'high' : 'medium',
          actionable: true,
          daysUntilEvent: daysUntilBilling,
          timestamp: new Date(),
        });
      }

      // Simulated usage alerts (normally would come from usage tracking)
      if (Math.random() < 0.2) { // 20% chance for demo
        const daysSinceLastUse = Math.floor(Math.random() * 60) + 30; // 30-90 days
        newNotifications.push({
          id: `usage_${subscription.id}`,
          type: 'usage_alert',
          title: `${subscription.name} hasn't been used recently`,
          message: `No activity detected for ${daysSinceLastUse} days. Consider pausing or canceling.`,
          subscriptionId: subscription.id,
          subscriptionName: subscription.name,
          priority: daysSinceLastUse > 60 ? 'high' : 'medium',
          actionable: true,
          potentialSavings: subscription.cost,
          timestamp: new Date(),
        });
      }

      // Savings opportunities
      if (subscription.cost > 20 && Math.random() < 0.3) { // 30% chance for expensive subscriptions
        const yearlyDiscount = Math.floor(Math.random() * 30) + 15; // 15-45% discount
        const monthlySavings = subscription.cost * (yearlyDiscount / 100);
        
        newNotifications.push({
          id: `savings_${subscription.id}`,
          type: 'savings_opportunity',
          title: `Save ${yearlyDiscount}% on ${subscription.name}`,
          message: `Switch to annual billing and save $${(monthlySavings * 12).toFixed(2)} per year`,
          subscriptionId: subscription.id,
          subscriptionName: subscription.name,
          priority: 'medium',
          actionable: true,
          potentialSavings: monthlySavings,
          timestamp: new Date(),
        });
      }
    });

    // General optimization tips
    const totalSpending = subscriptions.reduce((sum, sub) => sum + sub.cost, 0);
    if (totalSpending > 100) {
      newNotifications.push({
        id: 'optimization_tip_1',
        type: 'optimization_tip',
        title: 'Review your subscription portfolio',
        message: `You're spending $${totalSpending.toFixed(2)}/month on ${subscriptions.length} subscriptions. Our AI found potential optimizations.`,
        priority: 'low',
        actionable: true,
        potentialSavings: totalSpending * 0.2,
        timestamp: new Date(),
      });
    }

    // Sort by priority and timestamp
    newNotifications.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }
      return b.timestamp.getTime() - a.timestamp.getTime();
    });

    setNotifications(newNotifications);
  };

  const getNotificationIcon = (type: SmartNotification['type']) => {
    switch (type) {
      case 'renewal_reminder':
        return <Calendar size={16} color="#3B82F6" />;
      case 'usage_alert':
        return <AlertTriangle size={16} color="#F59E0B" />;
      case 'savings_opportunity':
        return <DollarSign size={16} color="#10B981" />;
      case 'price_change':
        return <TrendingDown size={16} color="#EF4444" />;
      case 'optimization_tip':
        return <Clock size={16} color="#8B5CF6" />;
      default:
        return <Bell size={16} color="#64748B" />;
    }
  };

  const getPriorityColor = (priority: SmartNotification['priority']) => {
    switch (priority) {
      case 'high': return '#EF4444';
      case 'medium': return '#F59E0B';
      case 'low': return '#3B82F6';
    }
  };

  const handleDismiss = (notificationId: string) => {
    setDismissed(prev => new Set([...prev, notificationId]));
  };

  const handleAction = (notification: SmartNotification, action: string) => {
    onNotificationAction?.(notification.id, action);
    handleDismiss(notification.id);
  };

  const visibleNotifications = notifications.filter(n => !dismissed.has(n.id));

  if (visibleNotifications.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Bell size={20} color="#3B82F6" />
        <Text style={styles.title}>Smart Alerts</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{visibleNotifications.length}</Text>
        </View>
      </View>

      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {visibleNotifications.map(notification => (
          <View 
            key={notification.id} 
            style={[
              styles.notificationCard,
              { borderLeftColor: getPriorityColor(notification.priority) }
            ]}
          >
            <View style={styles.notificationHeader}>
              <View style={styles.notificationIconContainer}>
                {getNotificationIcon(notification.type)}
              </View>
              <TouchableOpacity
                style={styles.dismissButton}
                onPress={() => handleDismiss(notification.id)}
              >
                <X size={14} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.notificationContent}>
              <Text style={styles.notificationTitle}>{notification.title}</Text>
              <Text style={styles.notificationMessage}>{notification.message}</Text>
              
              {notification.potentialSavings && (
                <View style={styles.savingsContainer}>
                  <DollarSign size={12} color="#10B981" />
                  <Text style={styles.savingsText}>
                    Save ${notification.potentialSavings.toFixed(2)}/month
                  </Text>
                </View>
              )}

              {notification.daysUntilEvent && (
                <View style={styles.urgencyContainer}>
                  <Clock size={12} color="#F59E0B" />
                  <Text style={styles.urgencyText}>
                    {notification.daysUntilEvent} day{notification.daysUntilEvent !== 1 ? 's' : ''} remaining
                  </Text>
                </View>
              )}
            </View>

            {notification.actionable && (
              <View style={styles.notificationActions}>
                {notification.type === 'renewal_reminder' && (
                  <>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.secondaryButton]}
                      onPress={() => handleAction(notification, 'cancel')}
                    >
                      <Text style={styles.secondaryButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.primaryButton]}
                      onPress={() => handleAction(notification, 'keep')}
                    >
                      <Text style={styles.primaryButtonText}>Keep</Text>
                    </TouchableOpacity>
                  </>
                )}

                {notification.type === 'usage_alert' && (
                  <>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.secondaryButton]}
                      onPress={() => handleAction(notification, 'pause')}
                    >
                      <Text style={styles.secondaryButtonText}>Pause</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.primaryButton]}
                      onPress={() => handleAction(notification, 'review')}
                    >
                      <Text style={styles.primaryButtonText}>Review</Text>
                    </TouchableOpacity>
                  </>
                )}

                {notification.type === 'savings_opportunity' && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.primaryButton]}
                    onPress={() => handleAction(notification, 'explore')}
                  >
                    <Text style={styles.primaryButtonText}>Explore Savings</Text>
                  </TouchableOpacity>
                )}

                {notification.type === 'optimization_tip' && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.primaryButton]}
                    onPress={() => handleAction(notification, 'analyze')}
                  >
                    <Text style={styles.primaryButtonText}>Get AI Analysis</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    flex: 1,
  },
  badge: {
    backgroundColor: '#3B82F6',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
  },
  scrollContent: {
    paddingRight: 16,
  },
  notificationCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
    marginRight: 12,
    width: 280,
    borderLeftWidth: 3,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  notificationIconContainer: {
    padding: 4,
  },
  dismissButton: {
    padding: 4,
  },
  notificationContent: {
    marginBottom: 12,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
    marginBottom: 8,
  },
  savingsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  savingsText: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '500',
  },
  urgencyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  urgencyText: {
    fontSize: 11,
    color: '#F59E0B',
    fontWeight: '500',
  },
  notificationActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#3B82F6',
  },
  secondaryButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  primaryButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
  },
  secondaryButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
});
