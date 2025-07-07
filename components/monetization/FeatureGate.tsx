import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Lock, Zap } from 'lucide-react-native';
import { useSubscription } from '@/hooks/useSubscription';
import { SUBSCRIPTION_PLANS } from '@/config/subscriptionPlans';

interface FeatureGateProps {
  feature: keyof typeof SUBSCRIPTION_PLANS.free.limits;
  requiredTier: 'free' | 'pro' | 'team';
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onUpgrade?: () => void;
}

export const FeatureGate: React.FC<FeatureGateProps> = ({
  feature,
  requiredTier,
  children,
  fallback,
  onUpgrade
}) => {
  const { canAccessFeature, currentTier } = useSubscription();

  const hasAccess = canAccessFeature(feature);

  if (hasAccess) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  const requiredPlan = SUBSCRIPTION_PLANS[requiredTier];

  return (
    <View style={styles.gateContainer}>
      <View style={styles.gateContent}>
        <Lock size={48} color="#94A3B8" />
        <Text style={styles.gateTitle}>
          {requiredPlan.name} Feature
        </Text>
        <Text style={styles.gateDescription}>
          This feature requires a {requiredPlan.name} subscription.
          Upgrade to unlock advanced capabilities.
        </Text>
        <TouchableOpacity style={styles.upgradeButton} onPress={onUpgrade}>
          <Zap size={16} color="#ffffff" />
          <Text style={styles.upgradeButtonText}>
            Upgrade to {requiredPlan.name}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  gateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  gateContent: {
    alignItems: 'center',
    maxWidth: 280,
  },
  gateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  gateDescription: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  upgradeButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});