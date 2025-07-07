import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Modal, ScrollView, Alert } from 'react-native';
import { X, Plus, Trash2, Mail, Users, Calculator } from 'lucide-react-native';
import { Subscription } from '@/types/subscription';
import { sharedSubscriptionsService } from '@/services/sharedSubscriptions';

interface ShareSubscriptionModalProps {
  visible: boolean;
  onClose: () => void;
  subscription: Subscription;
  userId: string;
}

interface Member {
  email: string;
  name: string;
  sharePercentage: number;
}

export const ShareSubscriptionModal: React.FC<ShareSubscriptionModalProps> = ({
  visible,
  onClose,
  subscription,
  userId,
}) => {
  const [groupName, setGroupName] = useState(`${subscription.name} Group`);
  const [description, setDescription] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  const [splitMethod, setSplitMethod] = useState<'equal' | 'percentage' | 'custom'>('equal');
  const [loading, setLoading] = useState(false);

  const addMember = () => {
    if (!newMemberEmail || !newMemberName) {
      Alert.alert('Error', 'Please enter both email and name');
      return;
    }

    if (members.find(m => m.email === newMemberEmail)) {
      Alert.alert('Error', 'Member with this email already added');
      return;
    }

    const sharePercentage = splitMethod === 'equal' ? 100 / (members.length + 2) : 0; // +2 for new member and owner
    
    setMembers([...members, {
      email: newMemberEmail,
      name: newMemberName,
      sharePercentage,
    }]);

    if (splitMethod === 'equal') {
      updateEqualSplit([...members, { email: newMemberEmail, name: newMemberName, sharePercentage }]);
    }

    setNewMemberEmail('');
    setNewMemberName('');
  };

  const removeMember = (index: number) => {
    const updatedMembers = members.filter((_, i) => i !== index);
    setMembers(updatedMembers);

    if (splitMethod === 'equal') {
      updateEqualSplit(updatedMembers);
    }
  };

  const updateEqualSplit = (membersList: Member[]) => {
    const totalMembers = membersList.length + 1; // +1 for owner
    const equalShare = 100 / totalMembers;
    
    setMembers(membersList.map(member => ({
      ...member,
      sharePercentage: equalShare,
    })));
  };

  const updateMemberShare = (index: number, percentage: number) => {
    const updatedMembers = [...members];
    updatedMembers[index].sharePercentage = percentage;
    setMembers(updatedMembers);
  };

  const getTotalPercentage = () => {
    return members.reduce((sum, member) => sum + member.sharePercentage, 0);
  };

  const getOwnerShare = () => {
    if (splitMethod === 'equal') {
      return 100 / (members.length + 1);
    }
    return Math.max(0, 100 - getTotalPercentage());
  };

  const createSharedGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }

    if (members.length === 0) {
      Alert.alert('Error', 'Please add at least one member');
      return;
    }

    if (splitMethod !== 'equal' && Math.abs(getTotalPercentage() + getOwnerShare() - 100) > 0.01) {
      Alert.alert('Error', 'Total percentage must equal 100%');
      return;
    }

    try {
      setLoading(true);
      
      await sharedSubscriptionsService.createSharedGroup({
        subscriptionId: subscription.id,
        name: groupName.trim(),
        description: description.trim(),
        totalCost: subscription.monthlyCost,
        members: members.map(member => ({
          email: member.email,
          name: member.name,
          sharePercentage: member.sharePercentage,
        })),
        splitMethod,
      });

      Alert.alert(
        'Success',
        'Shared group created successfully! Invitations have been sent to all members.',
        [{ text: 'OK', onPress: onClose }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to create shared group. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Share Subscription</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <X size={24} color="#64748B" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.subscriptionInfo}>
            <Text style={styles.subscriptionName}>{subscription.name}</Text>
            <Text style={styles.subscriptionCost}>${subscription.monthlyCost.toFixed(2)}/month</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Group Details</Text>
            <TextInput
              style={styles.input}
              value={groupName}
              onChangeText={setGroupName}
              placeholder="Group name"
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Description (optional)"
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Split Method</Text>
            <View style={styles.splitOptions}>
              {(['equal', 'percentage', 'custom'] as const).map((method) => (
                <TouchableOpacity
                  key={method}
                  style={[styles.splitOption, splitMethod === method && styles.splitOptionActive]}
                  onPress={() => {
                    setSplitMethod(method);
                    if (method === 'equal') {
                      updateEqualSplit(members);
                    }
                  }}
                >
                  <Text style={[styles.splitOptionText, splitMethod === method && styles.splitOptionTextActive]}>
                    {method === 'equal' ? 'Equal Split' : method === 'percentage' ? 'Percentage' : 'Custom'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Add Members</Text>
            <View style={styles.addMemberForm}>
              <TextInput
                style={[styles.input, styles.memberInput]}
                value={newMemberEmail}
                onChangeText={setNewMemberEmail}
                placeholder="Email address"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <TextInput
                style={[styles.input, styles.memberInput]}
                value={newMemberName}
                onChangeText={setNewMemberName}
                placeholder="Full name"
              />
              <TouchableOpacity style={styles.addButton} onPress={addMember}>
                <Plus size={20} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Members ({members.length + 1})</Text>
            
            {/* Owner */}
            <View style={styles.memberItem}>
              <View style={styles.memberInfo}>
                <Users size={16} color="#3B82F6" />
                <Text style={styles.memberName}>You (Owner)</Text>
              </View>
              <View style={styles.shareInfo}>
                <Text style={styles.sharePercentage}>{getOwnerShare().toFixed(1)}%</Text>
                <Text style={styles.shareAmount}>${(subscription.monthlyCost * getOwnerShare() / 100).toFixed(2)}</Text>
              </View>
            </View>

            {/* Members */}
            {members.map((member, index) => (
              <View key={index} style={styles.memberItem}>
                <View style={styles.memberInfo}>
                  <Mail size={16} color="#64748B" />
                  <View style={styles.memberDetails}>
                    <Text style={styles.memberName}>{member.name}</Text>
                    <Text style={styles.memberEmail}>{member.email}</Text>
                  </View>
                </View>
                <View style={styles.memberActions}>
                  {splitMethod !== 'equal' && (
                    <TextInput
                      style={styles.percentageInput}
                      value={member.sharePercentage.toString()}
                      onChangeText={(text) => updateMemberShare(index, parseFloat(text) || 0)}
                      keyboardType="numeric"
                      placeholder="0"
                    />
                  )}
                  <View style={styles.shareInfo}>
                    <Text style={styles.sharePercentage}>{member.sharePercentage.toFixed(1)}%</Text>
                    <Text style={styles.shareAmount}>${(subscription.monthlyCost * member.sharePercentage / 100).toFixed(2)}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => removeMember(index)}
                  >
                    <Trash2 size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>

          {splitMethod !== 'equal' && (
            <View style={styles.totalPercentage}>
              <View style={styles.percentageRow}>
                <Calculator size={16} color="#64748B" />
                <Text style={styles.percentageText}>
                  Total: {(getTotalPercentage() + getOwnerShare()).toFixed(1)}% / 100%
                </Text>
              </View>
              {Math.abs(getTotalPercentage() + getOwnerShare() - 100) > 0.01 && (
                <Text style={styles.percentageError}>Percentages must total 100%</Text>
              )}
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.createButton, loading && styles.createButtonDisabled]}
            onPress={createSharedGroup}
            disabled={loading}
          >
            <Text style={styles.createButtonText}>
              {loading ? 'Creating Group...' : 'Create Shared Group'}
            </Text>
          </TouchableOpacity>
        </View>
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
  subscriptionInfo: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    marginVertical: 16,
    alignItems: 'center',
  },
  subscriptionName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  subscriptionCost: {
    fontSize: 16,
    fontWeight: '500',
    color: '#059669',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1E293B',
    marginBottom: 12,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  splitOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  splitOption: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  splitOptionActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  splitOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
  },
  splitOptionTextActive: {
    color: '#3B82F6',
  },
  addMemberForm: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-end',
  },
  memberInput: {
    flex: 1,
    marginBottom: 0,
  },
  addButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  memberDetails: {
    marginLeft: 8,
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
  memberActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  percentageInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 12,
    width: 50,
    textAlign: 'center',
  },
  shareInfo: {
    alignItems: 'flex-end',
  },
  sharePercentage: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
  },
  shareAmount: {
    fontSize: 10,
    color: '#64748B',
  },
  removeButton: {
    padding: 4,
  },
  totalPercentage: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  percentageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  percentageText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1E293B',
  },
  percentageError: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  createButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  createButtonDisabled: {
    backgroundColor: '#94A3B8',
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});