import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react-native';
import { TYPOGRAPHY, TEXT_COLORS, SPACING } from '@/constants/Typography';

interface SpendingOverviewProps {
  totalSpending: number;
  monthlyChange: number;
  activeSubscriptions: number;
}

export const SpendingOverview = memo<SpendingOverviewProps>(({ totalSpending, monthlyChange, activeSubscriptions }) => {
  const isPositive = monthlyChange >= 0;

  return (
    <View style={styles.container}>
      <View style={styles.mainMetric}>
        <View style={styles.amountContainer}>
          <DollarSign size={24} color="#3B82F6" />
          <Text style={styles.amount}>${totalSpending.toFixed(2)}</Text>
        </View>
        <Text style={styles.label}>Monthly Spending</Text>
      </View>
      
      <View style={styles.metrics}>
        <View style={styles.metric}>
          <View style={[styles.changeContainer, { backgroundColor: isPositive ? '#FEF3F2' : '#F0FDF4' }]}>
            {isPositive ? (
              <TrendingUp size={16} color="#EF4444" />
            ) : (
              <TrendingDown size={16} color="#10B981" />
            )}
            <Text style={[styles.change, { color: isPositive ? '#EF4444' : '#10B981' }]}>
              {Math.abs(monthlyChange).toFixed(1)}%
            </Text>
          </View>
          <Text style={styles.metricLabel}>vs last month</Text>
        </View>
        
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{activeSubscriptions}</Text>
          <Text style={styles.metricLabel}>Active subscriptions</Text>
        </View>
      </View>
    </View>
  );
});

SpendingOverview.displayName = 'SpendingOverview';

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mainMetric: {
    alignItems: 'center',
    marginBottom: SPACING['2xl'],
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  amount: {
    ...TYPOGRAPHY.metricLarge,
    color: TEXT_COLORS.primary,
    marginLeft: SPACING.sm,
  },
  label: {
    ...TYPOGRAPHY.label,
    color: TEXT_COLORS.muted,
  },
  metrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metric: {
    flex: 1,
    alignItems: 'center',
  },
  changeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: SPACING.xs,
  },
  change: {
    ...TYPOGRAPHY.label,
    fontFamily: 'Inter-SemiBold',
    marginLeft: SPACING.xs,
  },
  metricValue: {
    ...TYPOGRAPHY.metric,
    fontSize: 20,
    color: TEXT_COLORS.primary,
    marginBottom: SPACING.xs,
  },
  metricLabel: {
    ...TYPOGRAPHY.caption,
    color: TEXT_COLORS.muted,
    textAlign: 'center',
  },
});