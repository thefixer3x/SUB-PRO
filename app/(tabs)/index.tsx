import React from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView } from 'react-native';
import { UpgradeRibbon } from '@/components/monetization/UpgradeRibbon';
import { AdBanner } from '@/components/monetization/AdBanner';
import { FeatureGate } from '@/components/monetization/FeatureGate';
import { PoweredByLanOnasis } from '@/components/branding/PoweredByLanOnasis';
import { useSubscription } from '@/hooks/useSubscription';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors } from '@/constants/theme';

export default function Dashboard() {
  const { currentTier } = useSubscription();
  const { colors } = useTheme();
  const dynamicStyles = React.useMemo(() => createStyles(colors), [colors]);

  return (
    <SafeAreaView style={dynamicStyles.container}>
      <ScrollView style={dynamicStyles.content} showsVerticalScrollIndicator={false}>
        <View style={dynamicStyles.header}>
          <Text style={dynamicStyles.title}>Dashboard</Text>
          <Text style={dynamicStyles.subtitle}>Welcome back! Here's your subscription overview.</Text>
        </View>

        <UpgradeRibbon />

        {/* Basic Dashboard Content */}
        <View style={dynamicStyles.metricsGrid}>
          <View style={dynamicStyles.metricCard}>
            <Text style={dynamicStyles.metricValue}>12</Text>
            <Text style={dynamicStyles.metricLabel}>Active Subscriptions</Text>
          </View>
          
          <View style={dynamicStyles.metricCard}>
            <Text style={dynamicStyles.metricValue}>$247.89</Text>
            <Text style={dynamicStyles.metricLabel}>Monthly Spending</Text>
          </View>
          
          <View style={dynamicStyles.metricCard}>
            <Text style={dynamicStyles.metricValue}>$2,974.68</Text>
            <Text style={dynamicStyles.metricLabel}>Yearly Total</Text>
          </View>
          
          <View style={dynamicStyles.metricCard}>
            <Text style={dynamicStyles.metricValue}>3</Text>
            <Text style={dynamicStyles.metricLabel}>Expiring Soon</Text>
          </View>
        </View>

        <AdBanner placement="home" />

        {/* Recent Activity */}
        <View style={dynamicStyles.section}>
          <Text style={dynamicStyles.sectionTitle}>Recent Activity</Text>
          
          <View style={dynamicStyles.activityList}>
            <View style={dynamicStyles.activityItem}>
              <View style={dynamicStyles.activityDot} />
              <View style={dynamicStyles.activityContent}>
                <Text style={dynamicStyles.activityTitle}>Netflix subscription renewed</Text>
                <Text style={dynamicStyles.activityTime}>2 hours ago</Text>
              </View>
              <Text style={dynamicStyles.activityAmount}>$15.99</Text>
            </View>
            
            <View style={dynamicStyles.activityItem}>
              <View style={dynamicStyles.activityDot} />
              <View style={dynamicStyles.activityContent}>
                <Text style={dynamicStyles.activityTitle}>Added Spotify Premium</Text>
                <Text style={dynamicStyles.activityTime}>1 day ago</Text>
              </View>
              <Text style={dynamicStyles.activityAmount}>$9.99</Text>
            </View>
            
            <View style={dynamicStyles.activityItem}>
              <View style={dynamicStyles.activityDot} />
              <View style={dynamicStyles.activityContent}>
                <Text style={dynamicStyles.activityTitle}>Canceled Adobe Creative Cloud</Text>
                <Text style={dynamicStyles.activityTime}>3 days ago</Text>
              </View>
              <Text style={[dynamicStyles.activityAmount, dynamicStyles.canceledAmount]}>-$52.99</Text>
            </View>
          </View>
        </View>

        {/* Smart Insights - Gated Feature */}
        <FeatureGate
          feature="smartInsights"
          requiredTier="pro"
          fallback={
            <View style={dynamicStyles.section}>
              <Text style={dynamicStyles.sectionTitle}>Upcoming Renewals</Text>
              <View style={dynamicStyles.renewalsList}>
                <View style={dynamicStyles.renewalItem}>
                  <Text style={dynamicStyles.renewalService}>Disney+</Text>
                  <Text style={dynamicStyles.renewalDate}>Tomorrow</Text>
                  <Text style={dynamicStyles.renewalAmount}>$7.99</Text>
                </View>
                <View style={dynamicStyles.renewalItem}>
                  <Text style={dynamicStyles.renewalService}>GitHub Pro</Text>
                  <Text style={dynamicStyles.renewalDate}>In 3 days</Text>
                  <Text style={dynamicStyles.renewalAmount}>$4.00</Text>
                </View>
                <View style={dynamicStyles.renewalItem}>
                  <Text style={dynamicStyles.renewalService}>Notion Pro</Text>
                  <Text style={dynamicStyles.renewalDate}>In 1 week</Text>
                  <Text style={dynamicStyles.renewalAmount}>$8.00</Text>
                </View>
              </View>
            </View>
          }
        >
          <View style={dynamicStyles.section}>
            <Text style={dynamicStyles.sectionTitle}>Smart Insights™</Text>
            
            <View style={dynamicStyles.insightCard}>
              <Text style={dynamicStyles.insightTitle}>💡 Optimization Opportunity</Text>
              <Text style={dynamicStyles.insightText}>
                You have 3 similar streaming services. Consolidating to a family plan could save you $23/month.
              </Text>
            </View>
            
            <View style={dynamicStyles.insightCard}>
              <Text style={dynamicStyles.insightTitle}>📈 Spending Trend</Text>
              <Text style={dynamicStyles.insightText}>
                Your subscription spending increased by 15% this month, mainly due to new productivity tools.
              </Text>
            </View>
            
            <View style={dynamicStyles.insightCard}>
              <Text style={dynamicStyles.insightTitle}>⚠️ Renewal Alert</Text>
              <Text style={dynamicStyles.insightText}>
                You have $47.98 in renewals coming up in the next 7 days.
              </Text>
            </View>
          </View>
        </FeatureGate>

        {currentTier === 'free' && <AdBanner placement="home" size="medium-rectangle" />}

        {/* Subtle Branding Credit */}
        <View style={dynamicStyles.brandingSection}>
          <PoweredByLanOnasis variant="minimal" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Dynamic styles function that responds to theme changes
const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    marginBottom: 24,
    gap: 12,
  },
  metricCard: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 16,
  },
  activityList: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1E293B',
    marginBottom: 2,
  },
  activityTime: {
    fontSize: 12,
    color: '#64748B',
  },
  activityAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
  },
  canceledAmount: {
    color: '#DC2626',
  },
  renewalsList: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  renewalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  renewalService: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#1E293B',
  },
  renewalDate: {
    fontSize: 12,
    color: '#64748B',
    marginRight: 16,
  },
  renewalAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  insightCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  insightText: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
  },
  brandingSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: 'center',
  },
});