import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { SubscriptionLogo } from '@/components/SubscriptionLogo';
import { Plus, Search, Share2, ChevronRight } from 'lucide-react-native';
import { useSubscription } from '@/hooks/useSubscription';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscriptions } from '@/hooks/useSubscriptions';
import { getDashboardStats } from '@/utils/subscriptionMath';
import type { Subscription } from '@/types/subscription';
import { ThemeColors } from '@/constants/theme';
import { AdBanner } from '@/components/monetization/AdBanner';
import { ShareSubscriptionModal } from '@/components/social/ShareSubscriptionModal';
import { PoweredByLanOnasis } from '@/components/branding/PoweredByLanOnasis';
import { AddSubscriptionModal } from '@/components/subscriptions/AddSubscriptionModal';
import { FeaturePreviewCard } from '@/components/features/FeaturePreviewCard';
import { getFeature, STATUS_LABEL } from '@/config/featureCatalog';

// Per-subscription actions that are not built yet. They are named here so the
// user knows they are coming, but nothing simulated is rendered (no sample
// card numbers, invented usage or fake approvals).
const UPCOMING_ACTIONS = ['virtual-cards', 'card-freeze', 'cancellation-assistant']
  .map((id) => getFeature(id))
  .filter((f): f is NonNullable<typeof f> => !!f);

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

/** The amount is charged once per billing cycle. */
const CYCLE_UNIT: Record<string, string> = {
  Weekly: 'week',
  Monthly: 'month',
  Quarterly: 'quarter',
  Annually: 'year',
};

/** Normalised monthly cost used in the summary bar. */
function toMonthly(sub: Subscription): number {
  switch (sub.billingCycle) {
    case 'Monthly': return sub.monthlyCost;
    case 'Weekly': return sub.monthlyCost * 52 / 12;
    case 'Quarterly': return sub.monthlyCost / 3;
    case 'Annually': return sub.monthlyCost / 12;
    default: return sub.monthlyCost;
  }
}

export default function Subscriptions() {
  const { currentTier, canAccessFeature, getRemainingLimit } = useSubscription();
  const { colors } = useTheme();
  const { user } = useAuth();
  const dynamicStyles = React.useMemo(() => createStyles(colors), [colors]);
  const [showShareModal, setShowShareModal] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const userId = user?.id;
  const { data: subscriptions, isLoading, error } = useSubscriptions(userId);

  const stats = React.useMemo(
    () => (subscriptions ? getDashboardStats(subscriptions) : null),
    [subscriptions],
  );

  const totalMonthly = subscriptions
    ? subscriptions.reduce((sum, s) => sum + toMonthly(s), 0)
    : 0;

  // The plan cap is checked against the real list inside the add form.
  const remainingSlots = getRemainingLimit('maxSubscriptions');
  const canShare = canAccessFeature('subscriptionSharing');

  const handleShare = (subscriptionId: string) => {
    if (!canShare) {
      router.push('/(tabs)/upgrade');
      return;
    }
    setShowShareModal(subscriptionId);
  };

  const renderSubscriptionCard = (subscription: Subscription) => (
    <View key={subscription.id} style={dynamicStyles.subscriptionCard}>
      <View style={dynamicStyles.subscriptionHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <SubscriptionLogo
            name={subscription.name}
            logoUrl={subscription.logoUrl}
            color={subscription.color}
            size={36}
          />
          <Text style={[dynamicStyles.subscriptionName, { marginLeft: 10 }]}>{subscription.name}</Text>
        </View>
        <Text style={dynamicStyles.subscriptionCost}>
          {fmtCurrency(subscription.monthlyCost, subscription.currency)}
          <Text style={dynamicStyles.subscriptionPlan}> / {CYCLE_UNIT[subscription.billingCycle] ?? 'cycle'}</Text>
        </Text>
      </View>
      <Text style={dynamicStyles.subscriptionPlan}>{subscription.planName}</Text>
      <Text style={dynamicStyles.subscriptionBilling}>
        Next billing: {new Date(subscription.renewalDate).toLocaleDateString()}
      </Text>
      
      <View style={dynamicStyles.embeddedFinanceActions}>
        <TouchableOpacity
          style={dynamicStyles.embeddedAction}
          onPress={() => handleShare(subscription.id.toString())}
          accessibilityRole="button"
          accessibilityLabel={`Share ${subscription.name}`}
        >
          <Share2 size={16} color={colors.info} />
          <Text style={dynamicStyles.embeddedActionText}>
            {canShare ? 'Share' : 'Share (Pro)'}
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={dynamicStyles.upcomingRow}
        onPress={() => router.push('/(tabs)/features')}
        accessibilityRole="link"
        accessibilityLabel="See what is coming for your subscriptions"
      >
        <Text style={dynamicStyles.upcomingText} numberOfLines={2}>
          {STATUS_LABEL.coming_soon}: {UPCOMING_ACTIONS.map((f) => f.title).join(' · ')}
        </Text>
        <ChevronRight size={16} color={colors.textMuted} />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={dynamicStyles.container}>
      <ScrollView style={dynamicStyles.content} showsVerticalScrollIndicator={false} contentContainerStyle={dynamicStyles.scrollContent}>
        <View style={dynamicStyles.header}>
          <Text style={dynamicStyles.title}>Subscriptions</Text>
          <Text style={dynamicStyles.subtitle}>Manage your active subscriptions</Text>
        </View>

        {currentTier === 'free' && remainingSlots !== null && (
          <View style={[
            dynamicStyles.limitWarning,
            remainingSlots <= 1 && dynamicStyles.limitWarningUrgent,
          ]}>
            <Text style={dynamicStyles.limitText}>
              {remainingSlots > 0
                ? `${remainingSlots} subscription slots remaining`
                : 'Subscription limit reached'}
            </Text>
            {remainingSlots <= 1 && (
              <TouchableOpacity
                style={dynamicStyles.upgradeLink}
                onPress={() => router.push('/(tabs)/upgrade')}
              >
                <Text style={dynamicStyles.upgradeLinkText}>Upgrade for unlimited</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={dynamicStyles.actionBar}>
          <View style={dynamicStyles.searchContainer}>
            <Search size={20} color={colors.textMuted} />
            <Text style={dynamicStyles.searchPlaceholder}>Search subscriptions...</Text>
          </View>

          <TouchableOpacity
            style={dynamicStyles.addButton}
            onPress={() => setShowAdd(true)}
            accessibilityRole="button"
            accessibilityLabel="Add subscription"
          >
            <Plus size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>

        <AdBanner placement="subscriptions" />

        {isLoading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : error ? (
          <Text style={dynamicStyles.emptyText}>Failed to load subscriptions.</Text>
        ) : !subscriptions || subscriptions.length === 0 ? (
          <View style={dynamicStyles.emptyState}>
            <Text style={dynamicStyles.emptyTitle}>No subscriptions yet</Text>
            <Text style={dynamicStyles.emptySubtitle}>
              Add your first subscription to start tracking spending.
            </Text>
            <TouchableOpacity
              style={dynamicStyles.emptyAddButton}
              onPress={() => setShowAdd(true)}
              accessibilityRole="button"
            >
              <Text style={dynamicStyles.emptyAddButtonText}>Add your first subscription</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={dynamicStyles.subscriptionsList}>
            {subscriptions.map(renderSubscriptionCard)}
          </View>
        )}

        <View style={dynamicStyles.previewSection}>
          {getFeature('bulk-import') && <FeaturePreviewCard feature={getFeature('bulk-import')!} />}
        </View>

        {currentTier === 'free' && <AdBanner placement="subscriptions" size="medium-rectangle" />}

        <View style={dynamicStyles.summary}>
          <Text style={dynamicStyles.summaryTitle}>Monthly Summary</Text>
          <View style={dynamicStyles.summaryRow}>
            <Text style={dynamicStyles.summaryLabel}>Active subscriptions</Text>
            <Text style={dynamicStyles.summaryValue}>{stats?.activeCount ?? 0}</Text>
          </View>
          <View style={dynamicStyles.summaryRow}>
            <Text style={dynamicStyles.summaryLabel}>Total monthly cost</Text>
            <Text style={dynamicStyles.summaryValue}>{fmtCurrency(totalMonthly)}</Text>
          </View>
          <View style={dynamicStyles.summaryRow}>
            <Text style={dynamicStyles.summaryLabel}>Annual projection</Text>
            <Text style={dynamicStyles.summaryValue}>{fmtCurrency(totalMonthly * 12)}</Text>
          </View>
        </View>

        <View style={dynamicStyles.brandingSection}>
          <PoweredByLanOnasis variant="minimal" />
        </View>
      </ScrollView>

      {/* Share Subscription Modal */}
      {showShareModal && (
        <ShareSubscriptionModal
          visible={!!showShareModal}
          onClose={() => setShowShareModal(null)}
          subscription={(subscriptions ?? []).find(sub => sub.id === showShareModal) as any}
          userId={userId ?? ''}
        />
      )}

      <AddSubscriptionModal visible={showAdd} onClose={() => setShowAdd(false)} />
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  upcomingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    gap: 6,
  },
  upcomingText: {
    flex: 1,
    fontSize: 12,
    color: colors.textMuted,
  },
  emptyAddButton: {
    marginTop: 16,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  emptyAddButtonText: {
    color: colors.textInverse,
    fontSize: 14,
    fontWeight: '600',
  },
  previewSection: {
    paddingHorizontal: 20,
  },
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
  limitWarning: {
    backgroundColor: colors.selected,
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  limitWarningUrgent: {
    backgroundColor: colors.selected,
    borderColor: colors.warning,
  },
  limitText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 8,
  },
  upgradeLink: {
    alignSelf: 'flex-start',
  },
  upgradeLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  actionBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 12,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchPlaceholder: {
    flex: 1,
    fontSize: 16,
    color: colors.textMuted,
    marginLeft: 12,
  },
  addButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonDisabled: {
    backgroundColor: colors.border,
  },
  subscriptionsList: {
    paddingHorizontal: 20,
    gap: 12,
  },
  subscriptionCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  subscriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  subscriptionName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  subscriptionCost: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.success,
  },
  subscriptionPlan: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  subscriptionBilling: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 12,
  },
  embeddedFinanceActions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  embeddedAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardSecondary,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  embeddedActionText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.text,
  },
  affiliateNote: {
    fontSize: 10,
    color: colors.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  featureComingSoon: {
    backgroundColor: colors.cardSecondary,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  comingSoonText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  featurePrompt: {
    backgroundColor: colors.cardSecondary,
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    marginVertical: 16,
  },
  featurePromptTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  featurePromptText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  bulkUploadButton: {
    backgroundColor: colors.primary,
    marginHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginVertical: 16,
  },
  bulkUploadText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textInverse,
  },
  summary: {
    backgroundColor: colors.card,
    marginHorizontal: 20,
    marginVertical: 24,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  embeddedFinanceSection: {
    backgroundColor: colors.cardSecondary,
    marginTop: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  embeddedFinanceHeader: {
    marginBottom: 16,
  },
  embeddedFinanceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  embeddedFinanceSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
  },
  financeServiceCard: {
    backgroundColor: colors.card,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  serviceTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  comingSoonBadge: {
    fontSize: 10,
    color: colors.warning,
    backgroundColor: colors.cardSecondary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    fontWeight: '500',
  },
  serviceDescription: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  upgradePrompt: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '500',
    marginTop: 8,
    textAlign: 'center',
  },
  futureFlagBadge: {
    fontSize: 10,
    color: colors.info,
    backgroundColor: colors.cardSecondary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    fontWeight: '500',
  },
  activeBadge: {
    fontSize: 10,
    color: colors.success,
    backgroundColor: colors.cardSecondary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    fontWeight: '500',
  },
  serviceActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardSecondary,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginTop: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  serviceActionText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.text,
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
});
