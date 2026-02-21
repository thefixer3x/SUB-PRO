import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Modal, TouchableOpacity } from 'react-native';
import { X } from 'lucide-react-native';
import { SharedGroupsDisplay } from '@/components/social/SharedGroupsDisplay';
import { SharedGroupDetails } from '@/components/social/SharedGroupDetails';
import { ShareSubscriptionModal } from '@/components/social/ShareSubscriptionModal';
import { SharedGroup } from '@/types/social';
import { useSubscriptions } from '@/hooks/useSubscriptions';
import { FeatureGate } from '@/components/monetization/FeatureGate';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors } from '@/constants/theme';

export default function SharedGroupsScreen() {
  const [userId, setUserId] = useState('user-123');
  const { data: subscriptions = [] } = useSubscriptions();
  const [selectedGroup, setSelectedGroup] = useState<SharedGroup | null>(null);
  const [showGroupDetails, setShowGroupDetails] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedSubscriptionId, setSelectedSubscriptionId] = useState<string | null>(null);
  const { colors } = useTheme();
  const dynamicStyles = React.useMemo(() => createStyles(colors), [colors]);

  const handleSelectGroup = (group: SharedGroup) => {
    setSelectedGroup(group);
    setShowGroupDetails(true);
  };

  const handleCreateGroup = () => {
    setShowShareModal(true);
  };

  const handleDeleteGroup = () => {
    setShowGroupDetails(false);
    setSelectedGroup(null);
  };

  const getSubscriptionById = (id: string) => {
    return subscriptions.find(sub => sub.id === id);
  };

  return (
    <SafeAreaView style={dynamicStyles.container}>
      <FeatureGate
        feature="smartInsights"
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
          userId={userId}
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
                userId={userId}
                onDeleteGroup={handleDeleteGroup}
              />
            )}
          </View>
        </Modal>

        {showShareModal && selectedSubscriptionId && (
          <ShareSubscriptionModal
            visible={showShareModal}
            onClose={() => setShowShareModal(false)}
            subscription={getSubscriptionById(selectedSubscriptionId)!}
            userId={userId}
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
});
