import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Calendar, CreditCard, CircleAlert as AlertCircle } from 'lucide-react-native';
import { Subscription } from '@/types/subscription';
import { useTheme } from '@/contexts/ThemeContext';
import { TYPOGRAPHY, SPACING } from '@/constants/Typography';

interface SubscriptionCardProps {
  subscription: Subscription;
  onPress?: () => void;
}

export const SubscriptionCard = memo<SubscriptionCardProps>(({ subscription, onPress }) => {
  const { colors } = useTheme();
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return '#10B981';
      case 'Trial': return '#F59E0B';
      case 'Paused': return '#64748B';
      case 'Expired': return '#EF4444';
      default: return '#64748B';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High': return '#EF4444';
      case 'Medium': return '#F59E0B';
      case 'Low': return '#10B981';
      default: return '#64748B';
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getDaysUntilRenewal = () => {
    if (!subscription.renewalDate) return null;
    const today = new Date();
    const renewal = new Date(subscription.renewalDate);
    const diffTime = renewal.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const { daysUntilRenewal, isRenewalSoon } = useMemo(() => {
    const days = getDaysUntilRenewal();
    return {
      daysUntilRenewal: days,
      isRenewalSoon: days !== null && days <= 7 && days >= 0,
    };
  }, [subscription.renewalDate]);

  const styles = createStyles(colors);

  return (
    <TouchableOpacity style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderLight }]} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.header}>
        <View style={styles.serviceInfo}>
          <View style={[styles.serviceDot, { backgroundColor: subscription.color || '#3B82F6' }]} />
          <View style={styles.serviceText}>
            <Text style={[styles.serviceName, { color: colors.text }]}>{subscription.name}</Text>
            <Text style={[styles.planName, { color: colors.textMuted }]}>{subscription.planName}</Text>
          </View>
        </View>
        <View style={styles.statusContainer}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(subscription.status) }]}>
            <Text style={styles.statusText}>{subscription.status}</Text>
          </View>
          <View style={[styles.priorityBadge, { borderColor: getPriorityColor(subscription.priority) }]}>
            <Text style={[styles.priorityText, { color: getPriorityColor(subscription.priority) }]}>
              {subscription.priority}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.details}>
        <View style={styles.costInfo}>
          <Text style={[styles.cost, { color: colors.text }]}>
            ${subscription.monthlyCost.toFixed(2)}
            <Text style={[styles.period, { color: colors.textMuted }]}>/{subscription.billingCycle.toLowerCase()}</Text>
          </Text>
          <Text style={styles.category}>{subscription.category}</Text>
        </View>

        {subscription.status === 'Active' && subscription.renewalDate && (
          <View style={styles.renewalInfo}>
            <Calendar size={14} color={colors.textMuted} />
            <Text style={[styles.renewalText, { color: colors.textMuted }]}>
              Renews {formatDate(new Date(subscription.renewalDate))}
            </Text>
            {isRenewalSoon && (
              <AlertCircle size={14} color="#F59E0B" style={styles.warningIcon} />
            )}
          </View>
        )}

        <View style={styles.paymentInfo}>
          <CreditCard size={14} color={colors.textMuted} />
          <Text style={[styles.paymentText, { color: colors.textMuted }]}>{subscription.paymentMethod}</Text>
        </View>

        {subscription.notes && (
          <Text style={[styles.notes, { color: colors.textMuted }]}>{subscription.notes}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
});

SubscriptionCard.displayName = 'SubscriptionCard';

const createStyles = (colors: any) => StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: SPACING.xl,
    marginBottom: SPACING.lg,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.lg,
  },
  serviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  serviceDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: SPACING.md,
  },
  serviceText: {
    flex: 1,
  },
  serviceName: {
    ...TYPOGRAPHY.cardHeader,
    marginBottom: 2,
  },
  planName: {
    ...TYPOGRAPHY.small,
  },
  statusContainer: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: SPACING.xs,
  },
  statusText: {
    ...TYPOGRAPHY.caption,
    fontFamily: 'Inter-SemiBold',
    color: '#ffffff',
  },
  priorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  priorityText: {
    ...TYPOGRAPHY.caption,
    fontSize: 10,
  },
  details: {
    gap: SPACING.sm,
  },
  costInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cost: {
    ...TYPOGRAPHY.metric,
    fontSize: 20,
  },
  period: {
    ...TYPOGRAPHY.small,
  },
  category: {
    ...TYPOGRAPHY.small,
    color: '#3B82F6',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 8,
  },
  renewalInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  renewalText: {
    ...TYPOGRAPHY.small,
    marginLeft: 6,
  },
  warningIcon: {
    marginLeft: 6,
  },
  paymentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentText: {
    ...TYPOGRAPHY.small,
    marginLeft: 6,
  },
  notes: {
    ...TYPOGRAPHY.body,
    fontStyle: 'italic',
    marginTop: SPACING.xs,
  },
});