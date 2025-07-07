import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Zap, X } from 'lucide-react-native';
import { useSubscription } from '@/hooks/useSubscription';

interface UpgradeRibbonProps {
  onDismiss?: () => void;
  onUpgrade?: () => void;
}

export const UpgradeRibbon: React.FC<UpgradeRibbonProps> = ({
  onDismiss,
  onUpgrade
}) => {
  const { currentTier, getRemainingLimit } = useSubscription();

  if (currentTier !== 'free') return null;

  const remainingSubscriptions = getRemainingLimit('maxSubscriptions');
  const isNearLimit = remainingSubscriptions !== null && remainingSubscriptions <= 1;

  return (
    <View style={[styles.ribbon, isNearLimit && styles.ribbonWarning]}>
      <View style={styles.content}>
        <Zap size={16} color="#ffffff" />
        <Text style={styles.text}>
          {isNearLimit 
            ? `Only ${remainingSubscriptions} subscription slots left!`
            : 'Unlock unlimited subscriptions with Pro'
          }
        </Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.upgradeButton} onPress={onUpgrade}>
          <Text style={styles.upgradeText}>Upgrade</Text>
        </TouchableOpacity>
        {onDismiss && (
          <TouchableOpacity style={styles.dismissButton} onPress={onDismiss}>
            <X size={16} color="#ffffff" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  ribbon: {
    backgroundColor: '#3B82F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    margin: 16,
    borderRadius: 8,
  },
  ribbonWarning: {
    backgroundColor: '#F59E0B',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  text: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  upgradeButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 8,
  },
  upgradeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  dismissButton: {
    padding: 4,
  },
});