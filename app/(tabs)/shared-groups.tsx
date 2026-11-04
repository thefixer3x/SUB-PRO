import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Modal, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { X } from 'lucide-react-native';
import { SharedGroupsDisplay } from '@/components/social/SharedGroupsDisplay';
import { SharedGroupDetails } from '@/components/social/SharedGroupDetails';
import { ShareSubscriptionModal } from '@/components/social/ShareSubscriptionModal';
import { ShareButton } from '@/components/social/ShareButton';
import { SharedGroup } from '@/types/social';
import { useSubscriptions } from '@/hooks/useSubscriptions';
import { useAuth } from '@/contexts/AuthContext';
import { FeatureGate } from '@/components/monetization/FeatureGate';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors } from '@/constants/theme';

export default function SharedGroupsScreen() {
  const { user } = useAuth();
  const userId = user?.id;
  const [userIdState] = useState(userId ?? 'user-123');
  const { data: subscriptionsData = [], isLoading: isLoadingSubscriptions } = useSubscriptions(userIdState);
  const subscriptions = subscriptionsData ?? [];
  const [selectedGroup, setSelectedGroup] = useState<SharedGroup | null>(null);
  const [showGroupDetails, setShowGroupDetails] = useState(false);
  const [showSubscriptionPicker, setShowSubscriptionPicker] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedSubscriptionId, setSelectedSubscriptionId] = useState<string | null>(null);
  // SharedGroupsDisplay loads its list once on mount. Bumping this remounts it so a
  // group created in the share modal is visible immediately instead of only after the
  // screen is revisited.
  const [groupsVersion, setGroupsVersion] = useState(0);
  const { colors } = useTheme();
  const dynamicStyles = React.useMemo(() => createStyles(colors), [colors]);

  const handleSelectGroup = (group: SharedGroup) => {
    setSelectedGroup(group);
    setShowGroupDetails(true);
  };

  // A shared group is always built around one subscription, so the user picks it first.
  const handleCreateGroup = () => {
    setShowSubscriptionPicker(true);
  };

  const handleSelectSubscription = (subscriptionId: string) => {
    setSelectedSubscriptionId(subscriptionId);
    setShowSubscriptionPicker(false);
    setShowShareModal(true);
  };

  const handleCloseShareModal = () => {
    setShowShareModal(false);
    setSelectedSubscriptionId(null);
    // The modal may have created a group; reload the list so it shows up now.
    setGroupsVersion(version => version + 1);
  };

  const handleDeleteGroup = () => {
    setShowGroupDetails(false);
    setSelectedGroup(null);
  };

  const getSubscriptionById = (id: string) => {
    return subscriptions.find(sub => sub.id === id);
  };

  const selectedSubscription = selectedSubscriptionId ? getSubscriptionById(selectedSubscriptionId) : undefined;

  // The chosen subscription can disappear while the share modal is open (it was deleted,
  // or the list reloaded). Close the modal rather than sharing a subscription we no longer have.
  useEffect(() => {
    if (showShareModal && selectedSubscriptionId && !selectedSubscription) {
      setShowShareModal(false);
      setSelectedSubscriptionId(null);
    }
  }, [showShareModal, selectedSubscriptionId, selectedSubscription]);

  return (
    <SafeAreaView style={dynamicStyles.container}>
      <FeatureGate
        feature="subscriptionSharing"
        requiredTier="pro"
        fallback={
          <View style={dynamicStyles.featureGate}>
            <Text style={dynamicStyles.featureGateTitle}>Pro Feature</Text>
            <Text style={dynamicStyles.featureGateText}>
              Subscription sharing is available on Pro and Team plans.
              Upgrade to share subscriptions with friends, family, or coworkers.
            </Text>
          </View>
        }
      >
        <SharedGroupsDisplay
          key={groupsVersion}
          userId={userIdState}
          onCreateGroup={handleCreateGroup}
          onSelectGroup={handleSelectGroup}
        />

        <Modal
          visible={showGroupDetails}
          animationType="slide"
          presentationStyle="pageSheet"
        >
          <View style={dynamicStyles.modalContainer}>
            <View style={dynamicStyles.modalHeader}>
              <Text style={dynamicStyles.modalTitle}>Group Details</Text>
              <TouchableOpacity style={dynamicStyles.closeButton} onPress={() => setShowGroupDetails(false)}>
                <X size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {selectedGroup && (
              <SharedGroupDetails
                group={selectedGroup}
                subscription={selectedGroup.subscriptionId ? getSubscriptionById(selectedGroup.subscriptionId) : undefined}
                userId={userIdState}
                onDeleteGroup={handleDeleteGroup}
              />
            )}
          </View>
        </Modal>

        <Modal
          visible={showSubscriptionPicker}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowSubscriptionPicker(false)}
        >
          <View style={dynamicStyles.modalContainer}>
            <View style={dynamicStyles.modalHeader}>
              <Text style={dynamicStyles.modalTitle}>Choose a Subscription</Text>
              <TouchableOpacity style={dynamicStyles.closeButton} onPress={() => setShowSubscriptionPicker(false)}>
                <X size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {isLoadingSubscriptions ? (
              <View style={dynamicStyles.pickerState}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={dynamicStyles.pickerStateText}>Loading subscriptions…</Text>
              </View>
            ) : subscriptions.length === 0 ? (
              <View style={dynamicStyles.pickerState}>
                <Text style={dynamicStyles.pickerStateTitle}>No subscriptions to share</Text>
                <Text style={dynamicStyles.pickerStateText}>
                  Add a subscription first, then share its cost with others.
                </Text>
              </View>
            ) : (
              <ScrollView style={dynamicStyles.pickerList}>
                {subscriptions.map(subscription => (
                  <View key={subscription.id} style={dynamicStyles.pickerItem}>
                    <View style={dynamicStyles.pickerItemInfo}>
                      <Text style={dynamicStyles.pickerItemName}>{subscription.name}</Text>
                      <Text style={dynamicStyles.pickerItemCost}>
                        ${subscription.monthlyCost.toFixed(2)}/month
                      </Text>
                    </View>
                    <ShareButton onPress={() => handleSelectSubscription(subscription.id)} />
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </Modal>

        {showShareModal && selectedSubscription && (
          <ShareSubscriptionModal
            visible={showShareModal}
            onClose={handleCloseShareModal}
            subscription={selectedSubscription}
            userId={userIdState}
          />
        )}
      </FeatureGate>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  featureGate: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  featureGateTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  featureGateText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
  },
  closeButton: {
    padding: 8,
  },
  pickerList: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    gap: 12,
  },
  pickerItemInfo: {
    flex: 1,
  },
  pickerItemName: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  pickerItemCost: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  pickerState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 12,
  },
  pickerStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  pickerStateText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
