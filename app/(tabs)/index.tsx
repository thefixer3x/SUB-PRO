import React from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, ChevronRight } from 'lucide-react-native';
import { UpgradeRibbon } from '@/components/monetization/UpgradeRibbon';
import { AdBanner } from '@/components/monetization/AdBanner';
import { PlanInbox } from '@/components/PlanInbox';
import { PoweredByLanOnasis } from '@/components/branding/PoweredByLanOnasis';
import { useSubscription } from '@/hooks/useSubscription';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscriptions } from '@/hooks/useSubscriptions';
import { getDashboardStats, splitByPrimaryCurrency } from '@/utils/subscriptionMath';
import { ThemeColors } from '@/constants/theme';
import { AddSubscriptionModal } from '@/components/subscriptions/AddSubscriptionModal';
import { FeaturePreviewCard } from '@/components/features/FeaturePreviewCard';
import { FEATURE_CATALOG } from '@/config/featureCatalog';

// Features worth discovering from Home: everything that is not the screen
// the user is already on. Coming-soon entries are descriptions only.
const EXPLORE = FEATURE_CATALOG.filter((f) => f.id !== 'plan-inbox');

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
  const router = useRouter();
  const [showAdd, setShowAdd] = React.useState(false);

  const displayName = user?.user_metadata?.full_name
    || user?.email?.split('@')[0]
    || 'there';

  const userId = user?.id;
  const { data: subscriptions, isLoading, error } = useSubscriptions(userId);

  // Counts and the renewal list use every subscription. Money totals use only
  // the subscriptions billed in the user's main currency: amounts in different
  // currencies cannot be added without an exchange rate.
  const split = React.useMemo(() => splitByPrimaryCurrency(subscriptions ?? []), [subscriptions]);
  const currency = split.currency;
  const stats = React.useMemo(
    () => (subscriptions ? getDashboardStats(subscriptions) : null),
    [subscriptions],
  );
  const money = React.useMemo(
    () => (subscriptions ? getDashboardStats(split.included) : null),
    [subscriptions, split],
  );

  return (
    <SafeAreaView style={dynamicStyles.container}>
      <ScrollView style={dynamicStyles.content} showsVerticalScrollIndicator={false} contentContainerStyle={dynamicStyles.scrollContent}>
        <View style={dynamicStyles.header}>
          <Text style={dynamicStyles.title}>Dashboard</Text>
          <Text style={dynamicStyles.subtitle}>Welcome back, {displayName}!</Text>
          <TouchableOpacity
            style={dynamicStyles.addButton}
            onPress={() => setShowAdd(true)}
            accessibilityRole="button"
            accessibilityLabel="Add subscription"
          >
            <Plus size={18} color={colors.textInverse} />
            <Text style={dynamicStyles.addButtonText}>Add subscription</Text>
          </TouchableOpacity>
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
              <Text style={dynamicStyles.metricValue}>{fmtCurrency(money?.monthlyTotal ?? 0, currency)}</Text>
              <Text style={dynamicStyles.metricLabel}>Monthly Spending</Text>
            </View>

            <View style={dynamicStyles.metricCard}>
              <Text style={dynamicStyles.metricValue}>{fmtCurrency(money?.annualTotal ?? 0, currency)}</Text>
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
            <TouchableOpacity
              style={[dynamicStyles.addButton, dynamicStyles.emptyAddButton]}
              onPress={() => setShowAdd(true)}
              accessibilityRole="button"
            >
              <Plus size={18} color={colors.textInverse} />
              <Text style={dynamicStyles.addButtonText}>Add your first subscription</Text>
            </TouchableOpacity>
          </View>
        )}

        {!!subscriptions?.length && (
          <TouchableOpacity
            style={dynamicStyles.linkRow}
            onPress={() => router.push('/(tabs)/subscriptions')}
            accessibilityRole="link"
          >
            <Text style={dynamicStyles.linkRowText}>
              See all {subscriptions.length} subscription{subscriptions.length === 1 ? '' : 's'}
            </Text>
            <ChevronRight size={18} color={colors.primary} />
          </TouchableOpacity>
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

        {split.excluded.length > 0 && (
          <View style={dynamicStyles.section}>
            <View style={dynamicStyles.insightCard}>
              <Text style={dynamicStyles.insightTitle}>Multiple Currencies</Text>
              <Text style={dynamicStyles.insightText}>
                Totals are in {currency}. {split.excluded.length} subscription
                {split.excluded.length > 1 ? 's' : ''} billed in {split.otherCurrencies.join(', ')}{' '}
                {split.excluded.length > 1 ? 'are' : 'is'} not included, because amounts in different
                currencies can't be added without an exchange rate.
              </Text>
            </View>
          </View>
        )}

        <PlanInbox currency={currency} />

        <View style={dynamicStyles.section}>
          <View style={dynamicStyles.sectionHeaderRow}>
            <Text style={[dynamicStyles.sectionTitle, dynamicStyles.sectionTitleInline]}>Explore SUB-PRO</Text>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/features')}
              accessibilityRole="link"
              accessibilityLabel="See all features"
            >
              <Text style={dynamicStyles.linkRowText}>All features</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {EXPLORE.map((feature) => (
              <FeaturePreviewCard key={feature.id} feature={feature} compact />
            ))}
          </ScrollView>
        </View>

        {currentTier === 'free' && <AdBanner placement="home" size="medium-rectangle" />}

        <View style={dynamicStyles.brandingSection}>
          <PoweredByLanOnasis variant="minimal" />
        </View>
      </ScrollView>
      <AddSubscriptionModal visible={showAdd} onClose={() => setShowAdd(false)} />
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
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  emptyAddButton: {
    alignSelf: 'center',
  },
  addButtonText: {
    color: colors.textInverse,
    fontSize: 14,
    fontWeight: '600',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    marginTop: -12,
    marginBottom: 16,
    gap: 2,
  },
  linkRowText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitleInline: {
    marginBottom: 0,
  },
  errorText: {
    fontSize: 14,
    color: colors.error,
    textAlign: 'center',
  },
});
