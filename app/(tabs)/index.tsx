import React from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, ActivityIndicator } from 'react-native';
import { UpgradeRibbon } from '@/components/monetization/UpgradeRibbon';
import { AdBanner } from '@/components/monetization/AdBanner';
import { FeatureGate } from '@/components/monetization/FeatureGate';
import { PoweredByLanOnasis } from '@/components/branding/PoweredByLanOnasis';
import { useSubscription } from '@/hooks/useSubscription';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscriptions } from '@/hooks/useSubscriptions';
import { getDashboardStats } from '@/utils/subscriptionMath';
import { ThemeColors } from '@/constants/theme';

/** Format a number as a locale-aware currency string, defaulting to USD. */
function fmtCurrency(amount: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export default function Dashboard() {
  const { currentTier } = useSubscription();
  const { colors } = useTheme();
  const { user } = useAuth();
  const dynamicStyles = React.useMemo(() => createStyles(colors), [colors]);

  const displayName = user?.user_metadata?.full_name
    || user?.email?.split('@')[0]
    || 'there';

  const userId = user?.id;
  const { data: subscriptions, isLoading, error } = useSubscriptions(userId);

  const stats = React.useMemo(
    () => (subscriptions ? getDashboardStats(subscriptions) : null),
    [subscriptions],
  );

  return (
    <SafeAreaView style={dynamicStyles.container}>
      <ScrollView style={dynamicStyles.content} showsVerticalScrollIndicator={false} contentContainerStyle={dynamicStyles.scrollContent}>
        <View style={dynamicStyles.header}>
          <Text style={dynamicStyles.title}>Dashboard</Text>
          <Text style={dynamicStyles.subtitle}>Welcome back, {displayName}!</Text>
        </View>

        <UpgradeRibbon />

        {/* Metrics */}
        {isLoading ? (
          <View style={dynamicStyles.metricsGrid}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : error ? (
          <View style={dynamicStyles.metricsGrid}>
            <Text style={dynamicStyles.errorText}>Failed to load subscriptions</Text>
          </View>
        ) : stats ? (
          <View style={dynamicStyles.metricsGrid}>
            <View style={dynamicStyles.metricCard}>
              <Text style={dynamicStyles.metricValue}>{stats.activeCount}</Text>
              <Text style={dynamicStyles.metricLabel}>Active Subscriptions</Text>
            </View>

            <View style={dynamicStyles.metricCard}>
              <Text style={dynamicStyles.metricValue}>{fmtCurrency(stats.monthlyTotal)}</Text>
              <Text style={dynamicStyles.metricLabel}>Monthly Spending</Text>
            </View>

            <View style={dynamicStyles.metricCard}>
              <Text style={dynamicStyles.metricValue}>{fmtCurrency(stats.annualTotal)}</Text>
              <Text style={dynamicStyles.metricLabel}>Yearly Total</Text>
            </View>

            <View style={dynamicStyles.metricCard}>
              <Text style={dynamicStyles.metricValue}>{stats.upcomingRenewals.length}</Text>
              <Text style={dynamicStyles.metricLabel}>Expiring Soon</Text>
            </View>
          </View>
        ) : (
          /* Empty state — new user with no subscriptions */
          <View style={dynamicStyles.emptyState}>
            <Text style={dynamicStyles.emptyTitle}>No subscriptions yet</Text>
            <Text style={dynamicStyles.emptySubtitle}>
              Add your first subscription to start tracking spending.
            </Text>
          </View>
        )}

        <AdBanner placement="home" />

        {/* Recent activity — show upcoming renewals */}
        <View style={dynamicStyles.section}>
          <Text style={dynamicStyles.sectionTitle}>Upcoming Renewals</Text>

          {isLoading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : stats && stats.upcomingRenewals.length > 0 ? (
            <View style={dynamicStyles.renewalsList}>
              {stats.upcomingRenewals.map((sub) => (
                <View key={sub.id} style={dynamicStyles.renewalItem}>
                  <Text style={dynamicStyles.renewalService}>{sub.name}</Text>
                  <Text style={dynamicStyles.renewalDate}>
                    {new Date(sub.renewalDate).toLocaleDateString()}
                  </Text>
                  <Text style={dynamicStyles.renewalAmount}>
                    {fmtCurrency(sub.monthlyCost, sub.currency)}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={dynamicStyles.emptyText}>No renewals in the next 7 days</Text>
          )}
        </View>

        <FeatureGate
          feature="smartInsights"
          requiredTier="pro"
          fallback={
            <View style={dynamicStyles.section}>
              <Text style={dynamicStyles.sectionTitle}>Insights</Text>
              <Text style={dynamicStyles.emptyText}>Upgrade to Pro for AI-powered insights.</Text>
            </View>
          }
        >
          <View style={dynamicStyles.section}>
            <Text style={dynamicStyles.sectionTitle}>Smart Insights</Text>

            {stats && stats.categoryBreakdown.length > 0 && (
              <View style={dynamicStyles.insightCard}>
                <Text style={dynamicStyles.insightTitle}>Top Category</Text>
                <Text style={dynamicStyles.insightText}>
                  {stats.categoryBreakdown[0]?.category} is your largest expense at{' '}
                  {fmtCurrency(stats.categoryBreakdown[0]?.amount ?? 0)}.
                </Text>
              </View>
            )}

            {stats && stats.mixedCurrencies && (
              <View style={dynamicStyles.insightCard}>
                <Text style={dynamicStyles.insightTitle}>Multiple Currencies</Text>
                <Text style={dynamicStyles.insightText}>
                  You have subscriptions in more than one currency. Totals are normalised to monthly USD.
                </Text>
              </View>
            )}

            {stats && (
              <View style={dynamicStyles.insightCard}>
                <Text style={dynamicStyles.insightTitle}>Renewal Alert</Text>
                <Text style={dynamicStyles.insightText}>
                  {stats.upcomingRenewals.length > 0
                    ? `${stats.upcomingRenewals.length} renewal${stats.upcomingRenewals.length > 1 ? 's' : ''} in the next 7 days.`
                    : 'No renewals coming up soon.'}
                </Text>
              </View>
            )}
          </View>
        </FeatureGate>

        {currentTier === 'free' && <AdBanner placement="home" size="medium-rectangle" />}

        <View style={dynamicStyles.brandingSection}>
          <PoweredByLanOnasis variant="minimal" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
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
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  renewalsList: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  renewalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  renewalService: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  renewalDate: {
    fontSize: 12,
    color: colors.textMuted,
    marginRight: 16,
  },
  renewalAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  insightCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  insightText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  brandingSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: 'center',
  },
  emptyState: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 24,
    marginHorizontal: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: 12,
  },
  errorText: {
    fontSize: 14,
    color: colors.error,
    textAlign: 'center',
  },
});
