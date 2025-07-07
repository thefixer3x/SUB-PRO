import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity } from 'react-native';
import { Crown, Check, Zap, Users, Settings, CreditCard } from 'lucide-react-native';
import { useSubscription } from '@/hooks/useSubscription';
import { usePayments } from '@/hooks/usePayments';
import { PlanComparison } from '@/components/monetization/PlanComparison';
import { SUBSCRIPTION_PLANS } from '@/config/subscriptionPlans';
import { SubscriptionTier } from '@/types/monetization';

export default function UpgradeScreen() {
  const { currentTier, subscription } = useSubscription();
  const { startUpgrade, openCustomerPortal, isLoading } = usePayments();
  const [showComparison, setShowComparison] = useState(false);

  const handleSelectPlan = async (tier: SubscriptionTier) => {
    setShowComparison(false);
    if (tier !== 'free' && tier !== currentTier) {
      await startUpgrade(tier);
    }
  };

  const renderCurrentPlan = () => {
    const plan = SUBSCRIPTION_PLANS[currentTier];
    
    return (
      <View style={styles.currentPlanCard}>
        <View style={styles.currentPlanHeader}>
          <Crown size={24} color="#F59E0B" />
          <Text style={styles.currentPlanTitle}>Current Plan</Text>
        </View>
        
        <Text style={styles.currentPlanName}>{plan.name}</Text>
        <Text style={styles.currentPlanPrice}>
          ${plan.price}{currentTier === 'team' && '/user'}/month
        </Text>
        
        <View style={styles.currentPlanFeatures}>
          {plan.features.slice(0, 3).map((feature, index) => (
            <View key={index} style={styles.featureRow}>
              <Check size={16} color="#10B981" />
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>

        {currentTier !== 'free' && (
          <TouchableOpacity 
            style={styles.manageButton}
            onPress={openCustomerPortal}
            disabled={isLoading}
          >
            <Settings size={16} color="#3B82F6" />
            <Text style={styles.manageButtonText}>Manage Subscription</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderUpgradeOptions = () => {
    const availablePlans = Object.entries(SUBSCRIPTION_PLANS)
      .filter(([tier]) => tier !== currentTier)
      .map(([tier, plan]) => ({ tier: tier as SubscriptionTier, plan }));

    return (
      <View style={styles.upgradeSection}>
        <Text style={styles.sectionTitle}>Available Plans</Text>
        
        {availablePlans.map(({ tier, plan }) => (
          <TouchableOpacity
            key={tier}
            style={[
              styles.planOption,
              tier === 'pro' && styles.popularPlan
            ]}
            onPress={() => handleSelectPlan(tier)}
          >
            {tier === 'pro' && (
              <View style={styles.popularBadge}>
                <Text style={styles.popularText}>Most Popular</Text>
              </View>
            )}
            
            <View style={styles.planHeader}>
              <View style={styles.planIcon}>
                {tier === 'pro' ? (
                  <Zap size={20} color="#F59E0B" />
                ) : tier === 'team' ? (
                  <Users size={20} color="#3B82F6" />
                ) : (
                  <Crown size={20} color="#64748B" />
                )}
              </View>
              
              <View style={styles.planInfo}>
                <Text style={styles.planName}>{plan.name}</Text>
                <Text style={styles.planPrice}>
                  ${plan.price}{tier === 'team' && '/user'}/month
                </Text>
              </View>
              
              <Text style={styles.selectText}>
                {tier === 'free' ? 'Downgrade' : 'Select'}
              </Text>
            </View>
            
            <Text style={styles.planDescription}>{plan.description}</Text>
            
            <View style={styles.planFeatures}>
              {plan.features.slice(0, 2).map((feature, index) => (
                <View key={index} style={styles.featureRow}>
                  <Check size={14} color="#10B981" />
                  <Text style={styles.featureTextSmall}>{feature}</Text>
                </View>
              ))}
            </View>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>
            {currentTier === 'free' ? 'Upgrade Your Plan' : 'Your Account'}
          </Text>
          <Text style={styles.subtitle}>
            {currentTier === 'free' 
              ? 'Unlock powerful features and take control of your subscriptions'
              : 'Manage your subscription and explore other plans'
            }
          </Text>
        </View>

        {renderCurrentPlan()}
        
        {renderUpgradeOptions()}

        <TouchableOpacity
          style={styles.compareButton}
          onPress={() => setShowComparison(true)}
        >
          <Text style={styles.compareButtonText}>Compare All Plans</Text>
        </TouchableOpacity>

        <View style={styles.benefits}>
          <Text style={styles.benefitsTitle}>Why Upgrade?</Text>
          
          <View style={styles.benefitItem}>
            <Zap size={20} color="#F59E0B" />
            <View style={styles.benefitText}>
              <Text style={styles.benefitTitle}>Unlimited Tracking</Text>
              <Text style={styles.benefitDescription}>
                Track unlimited subscriptions without restrictions
              </Text>
            </View>
          </View>
          
          <View style={styles.benefitItem}>
            <CreditCard size={20} color="#10B981" />
            <View style={styles.benefitText}>
              <Text style={styles.benefitTitle}>Advanced Analytics</Text>
              <Text style={styles.benefitDescription}>
                Get detailed insights with Smart Insights™ AI recommendations
              </Text>
            </View>
          </View>
          
          <View style={styles.benefitItem}>
            <Users size={20} color="#3B82F6" />
            <View style={styles.benefitText}>
              <Text style={styles.benefitTitle}>Team Collaboration</Text>
              <Text style={styles.benefitDescription}>
                Share and manage subscriptions with your team
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.guarantee}>
          <Text style={styles.guaranteeTitle}>30-Day Money-Back Guarantee</Text>
          <Text style={styles.guaranteeText}>
            Try any paid plan risk-free. If you're not satisfied, get a full refund within 30 days.
          </Text>
        </View>
      </ScrollView>

      <PlanComparison
        visible={showComparison}
        onClose={() => setShowComparison(false)}
        currentTier={currentTier}
        onSelectPlan={handleSelectPlan}
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
    lineHeight: 22,
  },
  currentPlanCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#F59E0B',
  },
  currentPlanHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  currentPlanTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F59E0B',
    marginLeft: 8,
  },
  currentPlanName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  currentPlanPrice: {
    fontSize: 16,
    color: '#64748B',
    marginBottom: 16,
  },
  currentPlanFeatures: {
    marginBottom: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureText: {
    fontSize: 14,
    color: '#1E293B',
    marginLeft: 8,
  },
  featureTextSmall: {
    fontSize: 12,
    color: '#1E293B',
    marginLeft: 8,
  },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  manageButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
  },
  upgradeSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 16,
  },
  planOption: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    position: 'relative',
  },
  popularPlan: {
    borderColor: '#F59E0B',
    borderWidth: 2,
  },
  popularBadge: {
    position: 'absolute',
    top: -8,
    right: 16,
    backgroundColor: '#F59E0B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  popularText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  planIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  planInfo: {
    flex: 1,
  },
  planName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
  },
  planPrice: {
    fontSize: 14,
    color: '#64748B',
  },
  selectText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
  },
  planDescription: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 12,
  },
  planFeatures: {
    gap: 6,
  },
  compareButton: {
    backgroundColor: '#3B82F6',
    marginHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 32,
  },
  compareButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  benefits: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  benefitsTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 16,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  benefitText: {
    flex: 1,
    marginLeft: 12,
  },
  benefitTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  benefitDescription: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
  },
  guarantee: {
    backgroundColor: '#F0FDF4',
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 12,
    marginBottom: 32,
  },
  guaranteeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#059669',
    marginBottom: 8,
  },
  guaranteeText: {
    fontSize: 14,
    color: '#047857',
    lineHeight: 20,
  },
});