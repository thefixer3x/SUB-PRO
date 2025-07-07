import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Users, Mail, DollarSign, Trash2, UserPlus, ExternalLink, Clock } from 'lucide-react-native';
import { SharedGroup, GroupMember, SplitCalculation } from '@/types/social';
import { sharedSubscriptionsService } from '@/services/sharedSubscriptions';
import { Subscription } from '@/types/subscription';

interface SharedGroupDetailsProps {
  group: SharedGroup;
  subscription?: Subscription;
  userId: string;
  onAddMember?: () => void;
  onDeleteGroup?: () => void;
}

export const SharedGroupDetails: React.FC<SharedGroupDetailsProps> = ({
  group,
  subscription,
  userId,
  onAddMember,
  onDeleteGroup,
}) => {
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [splitCalculations, setSplitCalculations] = useState<SplitCalculation[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadGroupData();
  }, [group.id]);

  const loadGroupData = async () => {
    try {
      setLoading(true);
      const groupMembers = await sharedSubscriptionsService.getGroupMembers(group.id);
      setMembers(groupMembers);
      
      const splits = await sharedSubscriptionsService.calculateSplits(group.id);
      setSplitCalculations(splits);
    } catch (error) {
      console.error('Failed to load group data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGroup = async () => {
    Alert.alert(
      'Delete Group',
      'Are you sure you want to delete this shared group? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              setDeleting(true);
              await sharedSubscriptionsService.deleteSharedGroup(group.id);
              if (onDeleteGroup) {
                onDeleteGroup();
              }
            } catch (error) {
              console.error('Failed to delete group:', error);
              Alert.alert('Error', 'Failed to delete group. Please try again.');
              setDeleting(false);
            }
          }
        }
      ]
    );
  };

  const openSplitwise = () => {
    // In a real app, you would use Linking to open Splitwise app or website
    Alert.alert(
      'Splitwise Integration',
      group.splitwiseGroupId 
        ? 'Opening Splitwise group...' 
        : 'This group is not yet integrated with Splitwise.'
    );
  };

  const removeMember = async (memberId: string) => {
    Alert.alert(
      'Remove Member',
      'Are you sure you want to remove this member?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove', 
          style: 'destructive',
          onPress: async () => {
            try {
              await sharedSubscriptionsService.removeMember(group.id, memberId);
              loadGroupData(); // Reload group data after member removal
            } catch (error) {
              console.error('Failed to remove member:', error);
              Alert.alert('Error', 'Failed to remove member. Please try again.');
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading group details...</Text>
      </View>
    );
  }

  if (deleting) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#EF4444" />
        <Text style={styles.loadingText}>Deleting group...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.groupInfo}>
          <Users size={24} color="#3B82F6" />
          <View style={styles.groupDetails}>
            <Text style={styles.groupName}>{group.name}</Text>
            {group.description && (
              <Text style={styles.groupDescription}>{group.description}</Text>
            )}
          </View>
        </View>
        
        <View style={styles.subscriptionInfo}>
          <Text style={styles.subscriptionName}>{subscription?.name || 'Subscription'}</Text>
          <Text style={styles.subscriptionCost}>${group.totalCost.toFixed(2)}/month</Text>
        </View>
      </View>

      <View style={styles.splitInfo}>
        <Text style={styles.sectionTitle}>Split Method</Text>
        <View style={styles.methodContainer}>
          <Text style={styles.methodText}>
            {group.splitMethod === 'equal' 
              ? 'Equal Split' 
              : group.splitMethod === 'percentage' 
                ? 'Percentage-Based Split' 
                : 'Custom Split'}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Members ({members.length})</Text>
          {onAddMember && (
            <TouchableOpacity style={styles.addButton} onPress={onAddMember}>
              <UserPlus size={18} color="#3B82F6" />
              <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
          )}
        </View>
        
        <View style={styles.membersContainer}>
          {members.map((member) => (
            <View key={member.id} style={styles.memberItem}>
              <View style={styles.memberInfo}>
                {member.status === 'accepted' ? (
                  <Users size={16} color="#10B981" />
                ) : (
                  <Mail size={16} color="#F59E0B" />
                )}
                <View style={styles.memberDetails}>
                  <Text style={styles.memberName}>{member.name}</Text>
                  <Text style={styles.memberEmail}>{member.email}</Text>
                </View>
              </View>
              
              <View style={styles.memberShare}>
                <Text style={styles.shareAmount}>
                  ${(group.totalCost * member.sharePercentage / 100).toFixed(2)}
                </Text>
                <Text style={styles.sharePercentage}>
                  ({member.sharePercentage.toFixed(1)}%)
                </Text>
                
                {group.ownerId === userId && member.id !== userId && (
                  <TouchableOpacity 
                    style={styles.removeButton} 
                    onPress={() => removeMember(member.id)}
                  >
                    <Trash2 size={16} color="#EF4444" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
        </View>
      </View>

      {splitCalculations.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Summary</Text>
          <View style={styles.paymentsContainer}>
            {splitCalculations.map((split, index) => (
              <View key={index} style={styles.paymentItem}>
                <Text style={styles.paymentName}>{split.memberName}</Text>
                <View style={styles.paymentDetails}>
                  <View style={styles.paymentRow}>
                    <Text style={styles.paymentLabel}>Share:</Text>
                    <Text style={styles.paymentValue}>${split.shareAmount.toFixed(2)}</Text>
                  </View>
                  <View style={styles.paymentRow}>
                    <Text style={styles.paymentLabel}>Paid:</Text>
                    <Text style={styles.paymentValue}>${split.totalPaid.toFixed(2)}</Text>
                  </View>
                  <View style={styles.paymentRow}>
                    <Text style={styles.paymentLabel}>Balance:</Text>
                    <Text style={[
                      styles.paymentValue, 
                      split.balance < 0 ? styles.negativeBalance : 
                      split.balance > 0 ? styles.positiveBalance : {}
                    ]}>
                      ${Math.abs(split.balance).toFixed(2)} 
                      {split.balance < 0 ? ' (owes)' : split.balance > 0 ? ' (owed)' : ''}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      <View style={styles.actionButtons}>
        {group.splitwiseGroupId && (
          <TouchableOpacity style={styles.splitwiseButton} onPress={openSplitwise}>
            <ExternalLink size={18} color="#3B82F6" />
            <Text style={styles.splitwiseButtonText}>View in Splitwise</Text>
          </TouchableOpacity>
        )}

        {group.ownerId === userId && (
          <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteGroup}>
            <Trash2 size={18} color="#FFFFFF" />
            <Text style={styles.deleteButtonText}>Delete Group</Text>
          </TouchableOpacity>
        )}
      </View>
      
      <View style={styles.footer}>
        <Clock size={14} color="#94A3B8" />
        <Text style={styles.footerText}>
          Created on {new Date(group.createdAt).toLocaleDateString()}
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  groupInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12,
  },
  groupDetails: {
    flex: 1,
  },
  groupName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  groupDescription: {
    fontSize: 14,
    color: '#64748B',
  },
  subscriptionInfo: {
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  subscriptionName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#0369A1',
    marginBottom: 4,
  },
  subscriptionCost: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0369A1',
  },
  splitInfo: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  methodContainer: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  methodText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#475569',
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 12,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    gap: 4,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#3B82F6',
  },
  membersContainer: {
    gap: 12,
  },
  memberItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  memberDetails: {
    flex: 1,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1E293B',
  },
  memberEmail: {
    fontSize: 12,
    color: '#64748B',
  },
  memberShare: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shareAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  sharePercentage: {
    fontSize: 12,
    color: '#64748B',
  },
  removeButton: {
    padding: 4,
  },
  paymentsContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
    gap: 12,
  },
  paymentItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 12,
  },
  paymentName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1E293B',
    marginBottom: 8,
  },
  paymentDetails: {
    gap: 4,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  paymentLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  paymentValue: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1E293B',
  },
  negativeBalance: {
    color: '#EF4444',
  },
  positiveBalance: {
    color: '#10B981',
  },
  actionButtons: {
    padding: 16,
    flexDirection: 'row',
    gap: 12,
  },
  splitwiseButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F9FF',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  splitwiseButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#3B82F6',
  },
  deleteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 16,
  },
  footerText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    fontSize: 16,
    color: '#64748B',
    marginTop: 16,
  },
});