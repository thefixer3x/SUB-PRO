import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Calendar } from 'lucide-react-native';
import { Subscription } from '@/types/subscription';

interface UpcomingRenewalsProps {
  subscriptions: Subscription[];
}

export const UpcomingRenewals = memo<UpcomingRenewalsProps>(({ subscriptions }) => {
  const upcomingRenewals = useMemo(() => 
    subscriptions
      .filter(sub => sub.status === 'Active' && sub.renewalDate)
      .sort((a, b) => new Date(a.renewalDate).getTime() - new Date(b.renewalDate).getTime())
      .slice(0, 3),
    [subscriptions]
  );

  const formatDate = (date: Date) => {
    const today = new Date();
    const diffTime = date.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays < 7) return `In ${diffDays} days`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {upcomingRenewals.map((subscription) => (
          <View key={subscription.id} style={styles.renewalItem}>
            <View style={[styles.serviceDot, { backgroundColor: subscription.color || '#3B82F6' }]} />
            <View style={styles.renewalInfo}>
              <Text style={styles.serviceName}>{subscription.name}</Text>
              <Text style={styles.planName}>{subscription.planName}</Text>
            </View>
            <View style={styles.renewalDetails}>
              <Text style={styles.amount}>${subscription.monthlyCost}</Text>
              <View style={styles.dateContainer}>
                <Calendar size={12} color="#64748B" />
                <Text style={styles.renewalDate}>
                  {formatDate(new Date(subscription.renewalDate))}
                </Text>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
});

UpcomingRenewals.displayName = 'UpcomingRenewals';

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  renewalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  serviceDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  renewalInfo: {
    flex: 1,
  },
  serviceName: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#1e293b',
    marginBottom: 2,
  },
  planName: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
  },
  renewalDetails: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#1e293b',
    marginBottom: 2,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  renewalDate: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
    marginLeft: 4,
  },
});