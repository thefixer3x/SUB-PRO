import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  MoreVertical,
  Calendar,
  CreditCard,
  Pause,
  Play,
  AlertTriangle,
  Trash2
} from 'lucide-react-native';
import { MaterialCommunityIcons, FontAwesome } from '@expo/vector-icons';
import { SubscriptionLogo } from '@/components/SubscriptionLogo';

const { width } = Dimensions.get('window');

interface Subscription {
  id: string;
  name: string;
  plan: string;
  cost: number;
  nextBilling: string;
  status: 'active' | 'paused' | 'cancelled';
  category: string;
  /** Explicit logo URL – if provided, used directly; otherwise auto-fetched by name */
  logo?: string;
  color: [string, string, ...string[]];
  iconLibrary?: 'MaterialCommunityIcons' | 'FontAwesome';
  iconName?: string;
  hasMCPIntegration?: boolean;
  /** Brand accent color for the fallback initial avatar */
  brandColor?: string;
}

interface ModernSubscriptionCardProps {
  subscription: Subscription;
  onPause?: (id: string) => void;
  onCancel?: (id: string) => void;
  onViewDetails?: (id: string) => void;
  onManagePayment?: (id: string) => void;
}

export const ModernSubscriptionCard: React.FC<ModernSubscriptionCardProps> = ({
  subscription,
  onPause,
  onCancel,
  onViewDetails,
  onManagePayment
}) => {
  const [showActions, setShowActions] = useState(false);
  const [scaleAnim] = useState(new Animated.Value(1));

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const getStatusColor = () => {
    switch (subscription.status) {
      case 'active': return '#10B981';
      case 'paused': return '#F59E0B';
      case 'cancelled': return '#EF4444';
      default: return '#6B7280';
    }
  };

  // Trend display removed — historical delta computation not yet implemented.
  // Showing fabricated trend data is misleading per PR review.

  const renderServiceIcon = () => {
    // Prefer SubscriptionLogo (auto-fetches brand logo by name/domain)
    return (
      <SubscriptionLogo
        name={subscription.name}
        logoUrl={subscription.logo}
        color={subscription.brandColor ?? 'rgba(255,255,255,0.3)'}
        size={40}
        borderRadius={10}
      />
    );
  };

  const formatNextBilling = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 0) return 'Due today';
    if (diffDays === 1) return 'Due tomorrow';
    if (diffDays <= 7) return `Due in ${diffDays} days`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const isOverdue = () => {
    const date = new Date(subscription.nextBilling);
    const now = new Date();
    return date.getTime() < now.getTime();
  };

  return (
    <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={() => onViewDetails?.(subscription.id)}
        activeOpacity={0.9}
      >
        <LinearGradient
          colors={subscription.color}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.card}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleSection}>
              <View style={styles.titleRow}>
                {renderServiceIcon()}
                <View style={styles.titleText}>
                  <Text style={styles.serviceName}>{subscription.name}</Text>
                  <Text style={styles.planName}>{subscription.plan}</Text>
                </View>
                {subscription.hasMCPIntegration && (
                  <View style={styles.mcpBadge}>
                    <Text style={styles.mcpText}>MCP</Text>
                  </View>
                )}
              </View>
            </View>
            
            <TouchableOpacity 
              style={styles.moreButton}
              onPress={() => setShowActions(!showActions)}
            >
              <MoreVertical size={20} color="white" />
            </TouchableOpacity>
          </View>

          {/* Cost and Status */}
          <View style={styles.costSection}>
            <View style={styles.costContainer}>
              <Text style={styles.currency}>$</Text>
              <Text style={styles.amount}>{subscription.cost.toFixed(2)}</Text>
              <Text style={styles.period}>/mo</Text>
            </View>
            
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
              <Text style={styles.statusText}>{subscription.status.toUpperCase()}</Text>
            </View>
          </View>

          {/* Billing Info */}
          <View style={styles.billingSection}>
            <View style={styles.billingInfo}>
              <Calendar size={16} color="rgba(255, 255, 255, 0.8)" />
              <Text style={styles.billingText}>
                {formatNextBilling(subscription.nextBilling)}
              </Text>
              {isOverdue() && (
                <AlertTriangle size={16} color="#FEF3C7" />
              )}
            </View>
            
          </View>

          {/* Action Buttons */}
          {showActions && (
            <View style={styles.actionsContainer}>
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => onManagePayment?.(subscription.id)}
              >
                <CreditCard size={16} color="white" />
                <Text style={styles.actionText}>Payment</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => onPause?.(subscription.id)}
              >
                {subscription.status === 'active' ? (
                  <Pause size={16} color="white" />
                ) : (
                  <Play size={16} color="white" />
                )}
                <Text style={styles.actionText}>
                  {subscription.status === 'active' ? 'Pause' : 'Resume'}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.actionButton, styles.dangerButton]}
                onPress={() => onCancel?.(subscription.id)}
              >
                <Trash2 size={16} color="white" />
                <Text style={styles.actionText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginVertical: 8,
  },
  card: {
    borderRadius: 20,
    padding: 20,
    minHeight: 160,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  titleSection: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleText: {
    flex: 1,
    marginLeft: 8,
  },
  mcpBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  mcpText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'white',
  },
  serviceName: {
    fontSize: 20,
    fontWeight: '700',
    color: 'white',
    marginBottom: 2,
  },
  planName: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  moreButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    padding: 8,
  },
  costSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  costContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  currency: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
    marginRight: 2,
  },
  amount: {
    fontSize: 32,
    fontWeight: '700',
    color: 'white',
  },
  period: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginLeft: 4,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },
  billingSection: {
    marginBottom: 8,
  },
  billingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  billingText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginLeft: 8,
    fontWeight: '500',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  dangerButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.3)',
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
    marginLeft: 4,
  },
});
