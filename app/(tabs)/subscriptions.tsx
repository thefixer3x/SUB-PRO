import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity } from 'react-native';
import { Plus, Search, CreditCard, Bot, ExternalLink, Share2, Brain } from 'lucide-react-native';
import { useSubscription } from '@/hooks/useSubscription';
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

export default function Subscriptions() {
  const { currentTier, canAccessFeature, getRemainingLimit } = useSubscription();
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

  const renderSubscriptionCard = (subscription: any) => (
    <View key={subscription.id} style={styles.subscriptionCard}>
      <View style={styles.subscriptionHeader}>
        <Text style={styles.subscriptionName}>{subscription.name}</Text>
        <Text style={styles.subscriptionCost}>${subscription.cost}</Text>
      </View>
      <Text style={styles.subscriptionPlan}>{subscription.plan}</Text>
      <Text style={styles.subscriptionBilling}>Next billing: {subscription.nextBilling}</Text>
      
      {/* Embedded Finance Section */}
      <FeatureGate
        feature="smartInsights"
        requiredTier="pro"
        fallback={
          <View style={styles.embeddedFinanceSection}>
            <View style={styles.embeddedFinanceHeader}>
              <Text style={styles.embeddedFinanceTitle}>🏦 Embedded Finance</Text>
              <Text style={styles.embeddedFinanceSubtitle}>Advanced financial services for your subscriptions</Text>
            </View>
            <View style={styles.featureComingSoon}>
              <Text style={styles.comingSoonText}>• Virtual Cards for secure payments</Text>
              <Text style={styles.comingSoonText}>• Credit services - we pay upfront</Text>
              <Text style={styles.comingSoonText}>• Automated cancellation bot</Text>
              <Text style={styles.comingSoonText}>• Payment optimization</Text>
              <Text style={styles.upgradePrompt}>Upgrade to Pro to unlock these features</Text>
            </View>
          </View>
        }
      >
        <View style={styles.embeddedFinanceSection}>
          <View style={styles.embeddedFinanceHeader}>
            <Text style={styles.embeddedFinanceTitle}>🏦 Embedded Finance</Text>
            <Text style={styles.embeddedFinanceSubtitle}>Advanced financial services for your subscriptions</Text>
          </View>

          {/* Virtual Cards Service */}
          <VirtualCardInlineView
            subscriptionId={subscription.id.toString()}
            subscriptionName={subscription.name}
            userId="current-user-id" // TODO: Get from auth context
            expanded={expandedVirtualCard === subscription.id.toString()}
            onToggle={() => {
              setExpandedVirtualCard(
                expandedVirtualCard === subscription.id.toString() 
                  ? null 
                  : subscription.id.toString()
              );
            }}
          />

          {/* Credit Service - Coming Soon */}
          <View style={styles.financeServiceCard}>
            <View style={styles.serviceHeader}>
              <Text style={styles.serviceTitle}>💳 Credit Service</Text>
              <Text style={styles.comingSoonBadge}>Coming Soon</Text>
            </View>
            <Text style={styles.serviceDescription}>
              We pay for this subscription upfront. Settle all payments monthly with flexible terms.
            </Text>
          </View>

          {/* AI Assistant - Future Flag */}
          <FeatureGate
            feature="smartInsights"
            requiredTier="pro"
            fallback={
              <View style={styles.financeServiceCard}>
                <View style={styles.serviceHeader}>
                  <Text style={styles.serviceTitle}>🤖 AI Assistant</Text>
                  <Text style={styles.futureFlagBadge}>Premium Feature</Text>
                </View>
                <Text style={styles.serviceDescription}>
                  Get personalized recommendations on which subscriptions to pause, cancel, or optimize based on your usage patterns and spending habits.
                </Text>
              </View>
            }
          >
            <View style={styles.financeServiceCard}>
              <View style={styles.serviceHeader}>
                <Text style={styles.serviceTitle}>🤖 AI Assistant</Text>
                <Text style={styles.activeBadge}>Active</Text>
              </View>
              <Text style={styles.serviceDescription}>
                Your personal subscription optimizer. Get AI-powered insights and recommendations.
              </Text>
              <TouchableOpacity
                style={styles.serviceActionButton}
                onPress={() => setShowAIAssistant(true)}
              >
                <Brain size={16} color="#8B5CF6" />
                <Text style={styles.serviceActionText}>Open AI Assistant</Text>
              </TouchableOpacity>
            </View>
          </FeatureGate>

          {/* Action Buttons */}
          <View style={styles.embeddedFinanceActions}>
            <TouchableOpacity
              style={styles.embeddedAction}
              onPress={() => setShowCancellationBot(subscription.id.toString())}
            >
              <Bot size={16} color="#F59E0B" />
              <Text style={styles.embeddedActionText}>Cancel via Bot</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.embeddedAction}
              onPress={() => handleShareSubscription(subscription.id.toString())}
            >
              <Share2 size={16} color="#8B5CF6" />
              <Text style={styles.embeddedActionText}>Share</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.embeddedAction}
              onPress={() => handleSwitchPlan(subscription)}
            >
              <ExternalLink size={16} color="#10B981" />
              <Text style={styles.embeddedActionText}>
                {subscription.hasAffiliateLink ? 'Switch Plan*' : 'Switch Plan'}
              </Text>
            </TouchableOpacity>
          </View>
          
          {subscription.hasAffiliateLink && (
            <Text style={styles.affiliateNote}>
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
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Subscriptions</Text>
          <Text style={styles.subtitle}>Manage your active subscriptions</Text>
        </View>

        {/* Subscription limit warning for free users */}
        {currentTier === 'free' && remainingSlots !== null && (
          <View style={[
            styles.limitWarning,
            remainingSlots <= 1 && styles.limitWarningUrgent
          ]}>
            <Text style={styles.limitText}>
              {remainingSlots > 0 
                ? `${remainingSlots} subscription slots remaining`
                : 'Subscription limit reached'
              }
            </Text>
            {remainingSlots <= 1 && (
              <TouchableOpacity style={styles.upgradeLink}>
                <Text style={styles.upgradeLinkText}>Upgrade for unlimited</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Search and Add Section */}
        <View style={styles.actionBar}>
          <View style={styles.searchContainer}>
            <Search size={20} color="#64748B" />
            <Text style={styles.searchPlaceholder}>Search subscriptions...</Text>
          </View>
          
          <TouchableOpacity 
            style={[
              styles.addButton,
              !canAddMore && styles.addButtonDisabled
            ]}
            onPress={handleAddSubscription}
            disabled={!canAddMore}
          >
            <Plus size={20} color={canAddMore ? "#ffffff" : "#94A3B8"} />
          </TouchableOpacity>
        </View>

        <AdBanner placement="subscriptions" />

        {/* Subscriptions List */}
        <View style={styles.subscriptionsList}>
          {subscriptions.map(renderSubscriptionCard)}
        </View>

        {/* Bulk Upload Feature Gate */}
        <FeatureGate
          feature="bulkUpload"
          requiredTier="pro"
          fallback={
            <View style={styles.featurePrompt}>
              <Text style={styles.featurePromptTitle}>Bulk Import</Text>
              <Text style={styles.featurePromptText}>
                Import multiple subscriptions at once with CSV upload. Available in Pro plan.
              </Text>
            </View>
          }
        >
          <TouchableOpacity style={styles.bulkUploadButton}>
            <Text style={styles.bulkUploadText}>Import from CSV</Text>
          </TouchableOpacity>
        </FeatureGate>

        {currentTier === 'free' && <AdBanner placement="subscriptions" size="medium-rectangle" />}

        {/* Summary */}
        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>Monthly Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Active subscriptions</Text>
            <Text style={styles.summaryValue}>{subscriptions.length}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total monthly cost</Text>
            <Text style={styles.summaryValue}>
              ${subscriptions.reduce((sum, sub) => sum + sub.cost, 0).toFixed(2)}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Annual projection</Text>
            <Text style={styles.summaryValue}>
              ${(subscriptions.reduce((sum, sub) => sum + sub.cost, 0) * 12).toFixed(2)}
            </Text>
          </View>
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

const styles = StyleSheet.create({
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
  limitWarning: {
    backgroundColor: '#EFF6FF',
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  limitWarningUrgent: {
    backgroundColor: '#FEF3F2',
    borderColor: '#F59E0B',
  },
  limitText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1E293B',
    marginBottom: 8,
  },
  upgradeLink: {
    alignSelf: 'flex-start',
  },
  upgradeLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
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
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchPlaceholder: {
    flex: 1,
    fontSize: 16,
    color: '#94A3B8',
    marginLeft: 12,
  },
  addButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonDisabled: {
    backgroundColor: '#E2E8F0',
  },
  subscriptionsList: {
    paddingHorizontal: 20,
    gap: 12,
  },
  subscriptionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
    color: '#1E293B',
  },
  subscriptionCost: {
    fontSize: 18,
    fontWeight: '700',
    color: '#059669',
  },
  subscriptionPlan: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 4,
  },
  subscriptionBilling: {
    fontSize: 12,
    color: '#94A3B8',
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
    backgroundColor: '#F8FAFC',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  embeddedActionText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1E293B',
  },
  affiliateNote: {
    fontSize: 10,
    color: '#64748B',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  featureComingSoon: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  comingSoonText: {
    fontSize: 12,
    color: '#64748B',
  },
  featurePrompt: {
    backgroundColor: '#F8FAFC',
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    alignItems: 'center',
    marginVertical: 16,
  },
  featurePromptTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  featurePromptText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
  bulkUploadButton: {
    backgroundColor: '#3B82F6',
    marginHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginVertical: 16,
  },
  bulkUploadText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  summary: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    marginVertical: 24,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
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
    color: '#64748B',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  embeddedFinanceSection: {
    backgroundColor: '#F8FAFC',
    marginTop: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  embeddedFinanceHeader: {
    marginBottom: 16,
  },
  embeddedFinanceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  embeddedFinanceSubtitle: {
    fontSize: 12,
    color: '#64748B',
  },
  financeServiceCard: {
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
    color: '#1E293B',
  },
  comingSoonBadge: {
    fontSize: 10,
    color: '#F59E0B',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    fontWeight: '500',
  },
  serviceDescription: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
  },
  upgradePrompt: {
    fontSize: 12,
    color: '#3B82F6',
    fontWeight: '500',
    marginTop: 8,
    textAlign: 'center',
  },
  futureFlagBadge: {
    fontSize: 10,
    color: '#8B5CF6',
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    fontWeight: '500',
  },
  activeBadge: {
    fontSize: 10,
    color: '#059669',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    fontWeight: '500',
  },
  serviceActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginTop: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  serviceActionText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1E293B',
  },
});