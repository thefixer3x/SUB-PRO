import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity } from 'react-native';
import { SubscriptionLogo } from '@/components/SubscriptionLogo';
import { Plus, Search, CreditCard, Bot, ExternalLink, Share2, Brain } from 'lucide-react-native';
import { useSubscription } from '@/hooks/useSubscription';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors } from '@/constants/theme';
import { AdBanner } from '@/components/monetization/AdBanner';
import { FeatureGate } from '@/components/monetization/FeatureGate';
import { VirtualCardManager } from '@/components/embeddedFinance/VirtualCardManager';
import { VirtualCardInlineView } from '@/components/VirtualCardInlineView';
import { CancellationBot } from '@/components/embeddedFinance/CancellationBot';
import { AIAssistant } from '@/components/embeddedFinance/AIAssistant';
import { SmartNotifications } from '@/components/embeddedFinance/SmartNotifications';
import { affiliateSystemService } from '@/services/affiliateSystem';
import { ShareSubscriptionModal } from '@/components/social/ShareSubscriptionModal';
import { ShareButton } from '@/components/social/ShareButton';
import { PoweredByLanOnasis } from '@/components/branding/PoweredByLanOnasis';

interface SubscriptionItem {
  id: number;
  name: string;
  plan: string;
  cost: number;
  nextBilling: string;
  status: 'active' | 'paused' | 'cancelled';
  vendorUrl: string;
  hasAffiliateLink: boolean;
  affiliateUrl: string | null;
  category: string;
  logo?: string;
  brandColor?: string;
}

export default function Subscriptions() {
  const { currentTier, canAccessFeature, getRemainingLimit } = useSubscription();
  const { colors } = useTheme();
  const dynamicStyles = React.useMemo(() => createStyles(colors), [colors]);
  const [showVirtualCards, setShowVirtualCards] = useState<string | null>(null);
  const [showCancellationBot, setShowCancellationBot] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState<string | null>(null);
  const [expandedVirtualCard, setExpandedVirtualCard] = useState<string | null>(null);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  
  const [subscriptions] = useState([
    { 
      id: 1, 
      name: 'Netflix', 
      plan: 'Premium', 
      cost: 15.99, 
      nextBilling: '2024-02-15', 
      status: 'active',
      vendorUrl: 'https://www.netflix.com',
      hasAffiliateLink: true,
      affiliateUrl: 'https://netflix.com/plans?ref=subscription_manager',
      category: 'streaming'
    },
    { 
      id: 2, 
      name: 'Spotify', 
      plan: 'Premium', 
      cost: 9.99, 
      nextBilling: '2024-02-20', 
      status: 'active',
      vendorUrl: 'https://www.spotify.com',
      hasAffiliateLink: false,
      affiliateUrl: null,
      category: 'streaming'
    },
    { 
      id: 3, 
      name: 'Adobe Creative', 
      plan: 'Photography', 
      cost: 9.99, 
      nextBilling: '2024-02-18', 
      status: 'active',
      vendorUrl: 'https://www.adobe.com',
      hasAffiliateLink: true,
      affiliateUrl: 'https://adobe.com/creativecloud?ref=subscription_manager',
      category: 'creative'
    },
    { 
      id: 4, 
      name: 'GitHub', 
      plan: 'Pro', 
      cost: 4.00, 
      nextBilling: '2024-02-22', 
      status: 'active',
      vendorUrl: 'https://github.com',
      hasAffiliateLink: false,
      affiliateUrl: null,
      category: 'productivity'
    },
    { 
      id: 5, 
      name: 'Notion', 
      plan: 'Personal Pro', 
      cost: 8.00, 
      nextBilling: '2024-02-25', 
      status: 'active',
      vendorUrl: 'https://notion.so',
      hasAffiliateLink: true,
      affiliateUrl: 'https://notion.so/pricing?ref=subscription_manager',
      category: 'productivity'
    },
  ]);

  const handleShareSubscription = (subscriptionId: string) => {
    setShowShareModal(subscriptionId);
  };

  const remainingSlots = getRemainingLimit('maxSubscriptions');
  const canAddMore = canAccessFeature('maxSubscriptions');

  const handleAddSubscription = () => {
    if (!canAddMore) {
      console.log('Upgrade required to add more subscriptions');
      return;
    }
    console.log('Add new subscription');
  };

  const handleSwitchPlan = async (subscription: any) => {
    if (subscription.hasAffiliateLink && subscription.affiliateUrl) {
      // Track affiliate click
      await affiliateSystemService.trackClick({
        affiliateLinkId: `aff_${subscription.id}`,
        userId: 'current-user-id', // TODO: Get from auth context
        userAgent: navigator.userAgent,
        ipAddress: 'user-ip', // TODO: Get actual IP
      });

      // Generate tracking URL
      const trackingUrl = affiliateSystemService.generateTrackingUrl(
        subscription.affiliateUrl,
        'current-user-id',
        subscription.id.toString()
      );

      // Open affiliate URL
      window.open(trackingUrl, '_blank');
    } else {
      // Open regular vendor URL
      window.open(subscription.vendorUrl, '_blank');
    }
  };

  const renderSubscriptionCard = (subscription: SubscriptionItem) => (
    <View key={subscription.id} style={dynamicStyles.subscriptionCard}>
      <View style={dynamicStyles.subscriptionHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <SubscriptionLogo
            name={subscription.name}
            logoUrl={subscription.logo}
            color={subscription.brandColor}
            size={36}
          />
          <Text style={[dynamicStyles.subscriptionName, { marginLeft: 10 }]}>{subscription.name}</Text>
        </View>
        <Text style={dynamicStyles.subscriptionCost}>${subscription.cost}</Text>
      </View>
      <Text style={dynamicStyles.subscriptionPlan}>{subscription.plan}</Text>
      <Text style={dynamicStyles.subscriptionBilling}>Next billing: {subscription.nextBilling}</Text>
      
      {/* Embedded Finance Section */}
      <FeatureGate
        feature="smartInsights"
        requiredTier="pro"
        fallback={
          <View style={dynamicStyles.embeddedFinanceSection}>
            <View style={dynamicStyles.embeddedFinanceHeader}>
              <Text style={dynamicStyles.embeddedFinanceTitle}>Embedded Finance</Text>
              <Text style={dynamicStyles.embeddedFinanceSubtitle}>Advanced financial services for your subscriptions</Text>
            </View>
            <View style={dynamicStyles.featureComingSoon}>
              <Text style={dynamicStyles.comingSoonText}>Virtual Cards for secure payments</Text>
              <Text style={dynamicStyles.comingSoonText}>Credit services - we pay upfront</Text>
              <Text style={dynamicStyles.comingSoonText}>Automated cancellation bot</Text>
              <Text style={dynamicStyles.comingSoonText}>Payment optimization</Text>
              <Text style={dynamicStyles.upgradePrompt}>Upgrade to Pro to unlock these features</Text>
            </View>
          </View>
        }
      >
        <View style={dynamicStyles.embeddedFinanceSection}>
          <View style={dynamicStyles.embeddedFinanceHeader}>
            <Text style={dynamicStyles.embeddedFinanceTitle}>Embedded Finance</Text>
            <Text style={dynamicStyles.embeddedFinanceSubtitle}>Advanced financial services for your subscriptions</Text>
          </View>

          <VirtualCardInlineView
            subscriptionId={subscription.id.toString()}
            subscriptionName={subscription.name}
            userId="current-user-id"
            expanded={expandedVirtualCard === subscription.id.toString()}
            onToggle={() => {
              setExpandedVirtualCard(
                expandedVirtualCard === subscription.id.toString() 
                  ? null 
                  : subscription.id.toString()
              );
            }}
          />

          <View style={dynamicStyles.financeServiceCard}>
            <View style={dynamicStyles.serviceHeader}>
              <Text style={dynamicStyles.serviceTitle}>Credit Service</Text>
              <Text style={dynamicStyles.comingSoonBadge}>Coming Soon</Text>
            </View>
            <Text style={dynamicStyles.serviceDescription}>
              We pay for this subscription upfront. Settle all payments monthly with flexible terms.
            </Text>
          </View>

          <FeatureGate
            feature="smartInsights"
            requiredTier="pro"
            fallback={
              <View style={dynamicStyles.financeServiceCard}>
                <View style={dynamicStyles.serviceHeader}>
                  <Text style={dynamicStyles.serviceTitle}>AI Assistant</Text>
                  <Text style={dynamicStyles.futureFlagBadge}>Premium Feature</Text>
                </View>
                <Text style={dynamicStyles.serviceDescription}>
                  Get personalized recommendations on which subscriptions to pause, cancel, or optimize based on your usage patterns and spending habits.
                </Text>
              </View>
            }
          >
            <View style={dynamicStyles.financeServiceCard}>
              <View style={dynamicStyles.serviceHeader}>
                <Text style={dynamicStyles.serviceTitle}>AI Assistant</Text>
                <Text style={dynamicStyles.activeBadge}>Active</Text>
              </View>
              <Text style={dynamicStyles.serviceDescription}>
                Your personal subscription optimizer. Get AI-powered insights and recommendations.
              </Text>
              <TouchableOpacity
                style={dynamicStyles.serviceActionButton}
                onPress={() => setShowAIAssistant(true)}
              >
                <Brain size={16} color={colors.info} />
                <Text style={dynamicStyles.serviceActionText}>Open AI Assistant</Text>
              </TouchableOpacity>
            </View>
          </FeatureGate>

          <View style={dynamicStyles.embeddedFinanceActions}>
            <TouchableOpacity
              style={dynamicStyles.embeddedAction}
              onPress={() => setShowCancellationBot(subscription.id.toString())}
            >
              <Bot size={16} color={colors.warning} />
              <Text style={dynamicStyles.embeddedActionText}>Cancel via Bot</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={dynamicStyles.embeddedAction}
              onPress={() => handleShareSubscription(subscription.id.toString())}
            >
              <Share2 size={16} color={colors.info} />
              <Text style={dynamicStyles.embeddedActionText}>Share</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={dynamicStyles.embeddedAction}
              onPress={() => handleSwitchPlan(subscription)}
            >
              <ExternalLink size={16} color={colors.success} />
              <Text style={dynamicStyles.embeddedActionText}>
                {subscription.hasAffiliateLink ? 'Switch Plan*' : 'Switch Plan'}
              </Text>
            </TouchableOpacity>
          </View>
          
          {subscription.hasAffiliateLink && (
            <Text style={dynamicStyles.affiliateNote}>
              * Affiliate link - we may earn a commission
            </Text>
          )}
        </View>
      </FeatureGate>
    </View>
  );

  const currentSubscription = subscriptions.find(sub => 
    sub.id.toString() === showVirtualCards || sub.id.toString() === showCancellationBot
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
            remainingSlots <= 1 && dynamicStyles.limitWarningUrgent
          ]}>
            <Text style={dynamicStyles.limitText}>
              {remainingSlots > 0 
                ? `${remainingSlots} subscription slots remaining`
                : 'Subscription limit reached'
              }
            </Text>
            {remainingSlots <= 1 && (
              <TouchableOpacity style={dynamicStyles.upgradeLink}>
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
            style={[
              dynamicStyles.addButton,
              !canAddMore && dynamicStyles.addButtonDisabled
            ]}
            onPress={handleAddSubscription}
            disabled={!canAddMore}
          >
            <Plus size={20} color={canAddMore ? "#ffffff" : colors.textMuted} />
          </TouchableOpacity>
        </View>

        <AdBanner placement="subscriptions" />

        <View style={dynamicStyles.subscriptionsList}>
          {subscriptions.map(renderSubscriptionCard)}
        </View>

        <FeatureGate
          feature="bulkUpload"
          requiredTier="pro"
          fallback={
            <View style={dynamicStyles.featurePrompt}>
              <Text style={dynamicStyles.featurePromptTitle}>Bulk Import</Text>
              <Text style={dynamicStyles.featurePromptText}>
                Import multiple subscriptions at once with CSV upload. Available in Pro plan.
              </Text>
            </View>
          }
        >
          <TouchableOpacity style={dynamicStyles.bulkUploadButton}>
            <Text style={dynamicStyles.bulkUploadText}>Import from CSV</Text>
          </TouchableOpacity>
        </FeatureGate>

        {currentTier === 'free' && <AdBanner placement="subscriptions" size="medium-rectangle" />}

        <View style={dynamicStyles.summary}>
          <Text style={dynamicStyles.summaryTitle}>Monthly Summary</Text>
          <View style={dynamicStyles.summaryRow}>
            <Text style={dynamicStyles.summaryLabel}>Active subscriptions</Text>
            <Text style={dynamicStyles.summaryValue}>{subscriptions.length}</Text>
          </View>
          <View style={dynamicStyles.summaryRow}>
            <Text style={dynamicStyles.summaryLabel}>Total monthly cost</Text>
            <Text style={dynamicStyles.summaryValue}>
              ${subscriptions.reduce((sum, sub) => sum + sub.cost, 0).toFixed(2)}
            </Text>
          </View>
          <View style={dynamicStyles.summaryRow}>
            <Text style={dynamicStyles.summaryLabel}>Annual projection</Text>
            <Text style={dynamicStyles.summaryValue}>
              ${(subscriptions.reduce((sum, sub) => sum + sub.cost, 0) * 12).toFixed(2)}
            </Text>
          </View>
        </View>

        <View style={dynamicStyles.brandingSection}>
          <PoweredByLanOnasis variant="minimal" />
        </View>
      </ScrollView>

      {/* Virtual Card Manager Modal */}
      {showVirtualCards && currentSubscription && (
        <VirtualCardManager
          subscriptionId={showVirtualCards}
          userId="current-user-id" // TODO: Get from auth context
          visible={!!showVirtualCards}
          onClose={() => setShowVirtualCards(null)}
        />
      )}

      {/* Cancellation Bot Modal */}
      {showCancellationBot && currentSubscription && (
        <CancellationBot
          subscriptionId={showCancellationBot}
          userId="current-user-id" // TODO: Get from auth context
          vendorUrl={currentSubscription.vendorUrl}
          subscriptionName={currentSubscription.name}
          visible={!!showCancellationBot}
          onClose={() => setShowCancellationBot(null)}
          onSuccess={() => {
            setShowCancellationBot(null);
            // TODO: Refresh subscriptions list
          }}
        />
      )}
      
      {/* Share Subscription Modal */}
      {showShareModal && (
        <ShareSubscriptionModal
          visible={!!showShareModal}
          onClose={() => setShowShareModal(null)}
          subscription={subscriptions.find(sub => sub.id.toString() === showShareModal) as any}
          userId="current-user-id" // TODO: Get from auth context
        />
      )}

      {/* AI Assistant Modal */}
      <AIAssistant
        subscriptions={subscriptions}
        userId="current-user-id" // TODO: Get from auth context
        visible={showAIAssistant}
        onClose={() => setShowAIAssistant(false)}
      />

      {/* Smart Notifications */}
      <SmartNotifications
        subscriptions={subscriptions}
        userId="current-user-id" // TODO: Get from auth context
      />
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
});