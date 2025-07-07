import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Modal, TouchableOpacity } from 'react-native';
import { X } from 'lucide-react-native';
import { SharedGroupsDisplay } from '@/components/social/SharedGroupsDisplay';
import { SharedGroupDetails } from '@/components/social/SharedGroupDetails';
import { ShareSubscriptionModal } from '@/components/social/ShareSubscriptionModal';
import { SharedGroup } from '@/types/social';
import { useSubscriptions } from '@/hooks/useSubscriptions';
import { FeatureGate } from '@/components/monetization/FeatureGate';

export default function SharedGroupsScreen() {
  const [userId, setUserId] = useState('user-123'); // In a real app, get from auth context
  const { data: subscriptions = [] } = useSubscriptions();
  const [selectedGroup, setSelectedGroup] = useState<SharedGroup | null>(null);
  const [showGroupDetails, setShowGroupDetails] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedSubscriptionId, setSelectedSubscriptionId] = useState<string | null>(null);

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
    <SafeAreaView style={styles.container}>
      <FeatureGate
        feature="smartInsights"
        requiredTier="pro"
        fallback={
          <View style={styles.featureGate}>
            <Text style={styles.featureGateTitle}>Pro Feature</Text>
            <Text style={styles.featureGateText}>
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

        {/* Group Details Modal */}
        <Modal
          visible={showGroupDetails}
          animationType="slide"
          presentationStyle="pageSheet"
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Group Details</Text>
              <TouchableOpacity style={styles.closeButton} onPress={() => setShowGroupDetails(false)}>
                <X size={24} color="#64748B" />
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

        {/* Share Subscription Modal */}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
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
    color: '#1E293B',
    marginBottom: 12,
  },
  featureGateText: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 24,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1E293B',
  },
  closeButton: {
    padding: 8,
  },
});