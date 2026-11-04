import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import {
  TrendingUp,
  DollarSign,
  Calendar,
  Sparkles,
  AlertCircle,
  BarChart3,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors } from '@/constants/theme';
import {
  getDashboardStats,
  calculatePotentialSavings,
  type CategoryBreakdown,
} from '@/utils/subscriptionMath';
import { useSubscription } from '@/hooks/useSubscription';
import { useSubscriptions } from '@/hooks/useSubscriptions';
import { useAuth } from '@/contexts/AuthContext';
import { AdBanner } from '@/components/monetization/AdBanner';
import { FeatureGate } from '@/components/monetization/FeatureGate';
import { PoweredByLanOnasis } from '@/components/branding/PoweredByLanOnasis';

// ─── Helpers ────────────────────────────────────────────────────────────────

const CATEGORY_COLORS = ['primary', 'success', 'warning', 'info', 'error', 'primary'] as const;

function getCatColor(index: number, colors: ThemeColors): string {
  const key = CATEGORY_COLORS[index % CATEGORY_COLORS.length];
  return (colors as unknown as Record<string, string>)[key];
}

function formatCurrency(amount: number, symbol = '$'): string {
  return `${symbol}${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

// ─── Metrics row ────────────────────────────────────────────────────────────

function MetricsRow({ stats }: { stats: ReturnType<typeof getDashboardStats> }) {
  const { colors } = useTheme();
  const s = createMetricsStyles(colors);

  return (
    <View style={s.row}>
      <View style={s.card}>
        <DollarSign size={22} color={colors.primary} />
        <Text style={s.value}>
          {formatCurrency(stats.monthlyTotal)}
        </Text>
        <Text style={s.label}>This Month</Text>
      </View>

      <View style={s.card}>
        <Calendar size={22} color={colors.warning} />
        <Text style={s.value}>
          {formatCurrency(stats.annualTotal)}
        </Text>
        <Text style={s.label}>Annual Total</Text>
      </View>

      <View style={s.card}>
        <BarChart3 size={22} color={colors.success} />
        <Text style={s.value}>{stats.activeCount}</Text>
        <Text style={s.label}>Active</Text>
      </View>
    </View>
  );
}

// ─── Category breakdown ─────────────────────────────────────────────────────

function CategoryList({
  categories,
}: {
  categories: CategoryBreakdown[];
}) {
  const { colors } = useTheme();
  const s = createCategoryStyles(colors);

  return (
    <View style={s.list}>
      {categories.map((cat, i) => (
        <View
          key={cat.category}
          style={[s.item, i === categories.length - 1 ? { borderBottomWidth: 0 } : null]}
        >
          <View style={[s.dot, { backgroundColor: getCatColor(i, colors) }]} />
          <Text style={s.name}>{cat.category}</Text>
          <Text style={s.amount}>{formatCurrency(cat.amount)}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Savings card ───────────────────────────────────────────────────────────

function SavingsCard({
  savings,
}: {
  savings: ReturnType<typeof calculatePotentialSavings>;
}) {
  const { colors } = useTheme();
  const s = createSavingsStyles(colors);

  if (savings.monthlyAmount <= 0) return null;

  return (
    <View style={s.card}>
      <View style={s.header}>
        <Sparkles size={18} color={colors.success} />
        <Text style={s.title}>Potential Savings</Text>
      </View>

      <Text style={s.total}>Save {formatCurrency(savings.monthlyAmount)}/mo</Text>

      {savings.reasons.map((reason, i) => (
        <View key={i} style={s.reason}>
          <Text style={s.reasonText}>{reason.description}</Text>
          <Text style={s.reasonAmt}>
            ~{formatCurrency(reason.monthlyAmount)}/mo
          </Text>
        </View>
      ))}
    </View>
  );
}

// ─── Upcoming renewals ──────────────────────────────────────────────────────

function RenewalsList({ renewals }: { renewals: ReturnType<typeof getDashboardStats>['upcomingRenewals'] }) {
  const { colors } = useTheme();
  const s = createRenewalStyles(colors);

  if (renewals.length === 0) return null;

  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>Upcoming Renewals</Text>
      {renewals.slice(0, 3).map((sub) => {
        const days = Math.max(
          0,
          Math.ceil((new Date(sub.renewalDate).getTime() - Date.now()) / 86400000),
        );
        return (
          <View key={sub.id} style={s.item}>
            <View style={s.left}>
              <Text style={s.subName}>{sub.name}</Text>
              <Text style={s.subCat}>{sub.category}</Text>
            </View>
            <View style={s.right}>
              <Text style={s.subAmount}>{formatCurrency(sub.monthlyCost)}</Text>
              <Text style={s.subDays}>{days === 0 ? 'Today' : `${days}d`}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ─── Empty state ────────────────────────────────────────────────────────────

function EmptyState() {
  const { colors } = useTheme();
  const s = createEmptyStyles(colors);

  return (
    <View style={s.container}>
      <TrendingUp size={56} color={colors.textMuted} />
      <Text style={s.title}>No subscriptions yet</Text>
      <Text style={s.description}>
        Add your first subscription on the Dashboard
        to see spending insights here.
      </Text>
    </View>
  );
}

// ─── Main screen ────────────────────────────────────────────────────────────

export default function Analytics() {
  const { currentTier } = useSubscription();
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const { user } = useAuth();

  const {
    data: subscriptions,
    isLoading,
    isError,
    error,
  } = useSubscriptions(user?.id);

  const hasData = subscriptions && subscriptions.length > 0;
  const stats = hasData ? getDashboardStats(subscriptions) : null;
  const savings = hasData ? calculatePotentialSavings(subscriptions) : null;

  if (isError) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.errorBox}>
            <AlertCircle size={32} color={colors.error} />
            <Text style={styles.errorTitle}>Something went wrong</Text>
            <Text style={styles.errorText}>
              {error instanceof Error ? error.message : 'Unable to load analytics.'}
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (isLoading || !hasData) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
        >
          {isLoading ? (
            <View style={styles.loader}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loaderText}>Loading your analytics…</Text>
            </View>
          ) : (
            <EmptyState />
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Analytics</Text>
          <Text style={styles.subtitle}>
            Your subscription spending at a glance
          </Text>
        </View>

        {/* Metrics */}
        {stats && <MetricsRow stats={stats} />}

        {/* Savings (conditional — hidden when none) */}
        {savings && savings.monthlyAmount > 0 && <SavingsCard savings={savings} />}

        <AdBanner placement="analytics" />

        {/* Upcoming renewals */}
        {stats && <RenewalsList renewals={stats.upcomingRenewals} />}

        {/* Category breakdown — basic tier */}
        <FeatureGate
          feature="smartInsights"
          requiredTier="pro"
          fallback={
            <View style={styles.basicAnalytics}>
              <Text style={styles.sectionTitle}>Category Breakdown</Text>
              {stats && <CategoryList categories={stats.categoryBreakdown} />}
            </View>
          }
        >
          {/* Pro — advanced insights */}
          <View style={styles.advancedAnalytics}>
            <Text style={styles.sectionTitle}>Smart Insights</Text>

            {savings && savings.monthlyAmount > 0 && (
              <View style={styles.insightCard}>
                <Text style={styles.insightTitle}>💡 Spending Optimization</Text>
                <Text style={styles.insightText}>
                  You could save ~{formatCurrency(savings.monthlyAmount)}/mo by
                  consolidating overlapping services and switching to annual plans.
                </Text>
              </View>
            )}

            {stats && stats.upcomingRenewals.length > 0 && (
              <View style={styles.insightCard}>
                <Text style={styles.insightTitle}>📅 Upcoming Renewals</Text>
                <Text style={styles.insightText}>
                  {stats.upcomingRenewals.length} subscription
                  {stats.upcomingRenewals.length > 1 ? 's' : ''} renew in the next 7 days.
                </Text>
              </View>
            )}

            <View style={styles.insightCard}>
              <Text style={styles.insightTitle}>📊 Category Breakdown</Text>
              <View style={styles.categoryInline}>
                {stats &&
                  stats.categoryBreakdown.map((cat) => (
                    <View key={cat.category} style={styles.catChip}>
                      <Text style={styles.catName}>{cat.category}</Text>
                      <Text style={styles.catAmt}>{formatCurrency(cat.amount)}</Text>
                    </View>
                  ))}
              </View>
            </View>
          </View>
        </FeatureGate>

        {currentTier === 'free' && (
          <AdBanner placement="analytics" size="medium-rectangle" />
        )}

        {/* Export */}
        <View style={styles.exportSection}>
          <Text style={styles.sectionTitle}>Export Data</Text>

          <FeatureGate
            feature="exportFormats"
            requiredTier="pro"
            fallback={
              <View style={styles.basicExport}>
                <Text style={styles.exportText}>Basic CSV export available</Text>
              </View>
            }
          >
            <View style={styles.exportOptions}>
              <Text style={styles.exportText}>Export in multiple formats:</Text>
              <View style={styles.exportButtons}>
                {['CSV', 'PDF', 'Excel', 'JSON'].map((fmt) => (
                  <View key={fmt} style={styles.exportButton}>
                    <Text style={styles.exportButtonText}>{fmt}</Text>
                  </View>
                ))}
              </View>
            </View>
          </FeatureGate>
        </View>

        <View style={styles.brandingSection}>
          <PoweredByLanOnasis variant="minimal" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { flex: 1 },
    scrollContent: { paddingBottom: 100 },
    header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24 },
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
    loader: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 80,
    },
    loaderText: {
      marginTop: 16,
      fontSize: 15,
      color: colors.textMuted,
    },
    errorBox: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
    },
    errorTitle: {
      marginTop: 16,
      fontSize: 18,
      fontWeight: '600',
      color: colors.error,
    },
    errorText: {
      marginTop: 8,
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    basicAnalytics: { paddingHorizontal: 20, marginBottom: 24 },
    advancedAnalytics: { paddingHorizontal: 20, marginBottom: 24 },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
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
    categoryInline: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    catChip: {
      backgroundColor: colors.backgroundSecondary,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    catName: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    catAmt: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    exportSection: { paddingHorizontal: 20, marginBottom: 32 },
    basicExport: {
      backgroundColor: colors.cardSecondary,
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: 'dashed',
    },
    exportOptions: {
      backgroundColor: colors.card,
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    exportText: {
      fontSize: 14,
      color: colors.textMuted,
      marginBottom: 12,
    },
    exportButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    exportButton: {
      backgroundColor: colors.backgroundSecondary,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
    },
    exportButtonText: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.text,
    },
    brandingSection: {
      paddingHorizontal: 20,
      paddingVertical: 16,
      alignItems: 'center',
    },
  });
}

function createMetricsStyles(colors: ThemeColors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      paddingHorizontal: 20,
      marginBottom: 20,
      gap: 12,
    },
    card: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    value: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginTop: 8,
      marginBottom: 4,
    },
    label: {
      fontSize: 12,
      color: colors.textMuted,
      textAlign: 'center',
    },
  });
}

function createCategoryStyles(colors: ThemeColors) {
  return StyleSheet.create({
    list: {
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    dot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      marginRight: 12,
    },
    name: {
      flex: 1,
      fontSize: 14,
      fontWeight: '500',
      color: colors.text,
    },
    amount: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
  });
}

function createSavingsStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 8,
    },
    title: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    total: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.success,
      marginBottom: 12,
    },
    reason: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 6,
      paddingHorizontal: 4,
    },
    reasonText: {
      fontSize: 13,
      color: colors.textSecondary,
      flex: 1,
    },
    reasonAmt: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.success,
      marginLeft: 12,
    },
  });
}

function createRenewalStyles(colors: ThemeColors) {
  return StyleSheet.create({
    section: {
      paddingHorizontal: 20,
      marginBottom: 20,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
    },
    item: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 10,
      padding: 14,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    left: {
      flex: 1,
    },
    subName: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    subCat: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    right: {
      alignItems: 'flex-end',
    },
    subAmount: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    subDays: {
      fontSize: 12,
      color: colors.warning,
      marginTop: 2,
    },
  });
}

function createEmptyStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
      paddingVertical: 80,
    },
    title: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
      marginTop: 16,
      marginBottom: 8,
    },
    description: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
    },
  });
}