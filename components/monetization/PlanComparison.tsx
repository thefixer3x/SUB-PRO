import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal } from 'react-native';
import { Check, X, Zap, Users, Crown } from 'lucide-react-native';
import { SUBSCRIPTION_PLANS } from '@/config/subscriptionPlans';
import { SubscriptionTier } from '@/types/monetization';

interface PlanComparisonProps {
  visible: boolean;
  onClose: () => void;
  currentTier: SubscriptionTier;
  onSelectPlan: (tier: SubscriptionTier) => void;
}

export const PlanComparison: React.FC<PlanComparisonProps> = ({
  visible,
  onClose,
  currentTier,
  onSelectPlan
}) => {
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>(currentTier);

  const renderPlanCard = (tier: SubscriptionTier) => {
    const plan = SUBSCRIPTION_PLANS[tier];
    const isCurrentPlan = tier === currentTier;
    const isSelected = tier === selectedTier;
    const isPopular = tier === 'pro';

    const planIcon = {
      free: <Zap size={24} color="#64748B" />,
      pro: <Crown size={24} color="#F59E0B" />,
      team: <Users size={24} color="#3B82F6" />
    };

    return (
      <TouchableOpacity
        key={tier}
        style={[
          styles.planCard,
          isSelected && styles.planCardSelected,
          isPopular && styles.planCardPopular
        ]}
        onPress={() => setSelectedTier(tier)}
        disabled={isCurrentPlan}
      >
        {isPopular && (
          <View style={styles.popularBadge}>
            <Text style={styles.popularText}>Most Popular</Text>
          </View>
        )}
        
        <View style={styles.planHeader}>
          {planIcon[tier]}
          <Text style={styles.planName}>{plan.name}</Text>
          {isCurrentPlan && (
            <View style={styles.currentBadge}>
              <Text style={styles.currentText}>Current</Text>
            </View>
          )}
        </View>

        <View style={styles.priceContainer}>
          <Text style={styles.price}>
            ${plan.price}
            {tier === 'team' && <Text style={styles.perUser}>/user</Text>}
          </Text>
          <Text style={styles.billingCycle}>per month</Text>
        </View>

        <Text style={styles.description}>{plan.description}</Text>

        <View style={styles.featuresList}>
          {plan.features.map((feature, index) => (
            <View key={index} style={styles.featureItem}>
              <Check size={16} color="#10B981" />
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>

        {!isCurrentPlan && (
          <TouchableOpacity
            style={[
              styles.selectButton,
              isSelected && styles.selectButtonSelected
            ]}
            onPress={() => onSelectPlan(tier)}
          >
            <Text style={[
              styles.selectButtonText,
              isSelected && styles.selectButtonTextSelected
            ]}>
              {tier === 'free' ? 'Downgrade' : 'Select Plan'}
            </Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Choose Your Plan</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <X size={24} color="#64748B" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.subtitle}>
            Select the perfect plan for your subscription management needs
          </Text>

          <View style={styles.plansContainer}>
            {Object.keys(SUBSCRIPTION_PLANS).map((tier) => 
              renderPlanCard(tier as SubscriptionTier)
            )}
          </View>

          <View style={styles.faqSection}>
            <Text style={styles.faqTitle}>Frequently Asked Questions</Text>
            
            <View style={styles.faqItem}>
              <Text style={styles.faqQuestion}>Can I change plans anytime?</Text>
              <Text style={styles.faqAnswer}>
                Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately.
              </Text>
            </View>

            <View style={styles.faqItem}>
              <Text style={styles.faqQuestion}>What happens to my data if I downgrade?</Text>
              <Text style={styles.faqAnswer}>
                Your data is always safe. If you exceed limits after downgrading, you'll have read-only access until you're within limits.
              </Text>
            </View>

            <View style={styles.faqItem}>
              <Text style={styles.faqQuestion}>Is there a free trial for paid plans?</Text>
              <Text style={styles.faqAnswer}>
                Yes! All paid plans come with a 14-day free trial. No credit card required.
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1E293B',
  },
  closeButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    marginVertical: 20,
  },
  plansContainer: {
    gap: 16,
    marginBottom: 32,
  },
  planCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    position: 'relative',
  },
  planCardSelected: {
    borderColor: '#3B82F6',
    backgroundColor: '#EFF6FF',
  },
  planCardPopular: {
    borderColor: '#F59E0B',
  },
  popularBadge: {
    position: 'absolute',
    top: -10,
    right: 20,
    backgroundColor: '#F59E0B',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  popularText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  planName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
    marginLeft: 12,
    flex: 1,
  },
  currentBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  currentText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  price: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1E293B',
  },
  perUser: {
    fontSize: 16,
    fontWeight: '500',
    color: '#64748B',
  },
  billingCycle: {
    fontSize: 16,
    color: '#64748B',
    marginLeft: 8,
  },
  description: {
    fontSize: 16,
    color: '#64748B',
    marginBottom: 20,
  },
  featuresList: {
    gap: 12,
    marginBottom: 24,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureText: {
    fontSize: 14,
    color: '#1E293B',
    marginLeft: 12,
  },
  selectButton: {
    backgroundColor: '#E2E8F0',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  selectButtonSelected: {
    backgroundColor: '#3B82F6',
  },
  selectButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
  },
  selectButtonTextSelected: {
    color: '#ffffff',
  },
  faqSection: {
    marginBottom: 32,
  },
  faqTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 16,
  },
  faqItem: {
    marginBottom: 20,
  },
  faqQuestion: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  faqAnswer: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
  },
});