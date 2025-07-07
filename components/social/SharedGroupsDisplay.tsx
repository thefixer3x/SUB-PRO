import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { Users, Plus } from 'lucide-react-native';
import { SharedGroup } from '@/types/social';
import { sharedSubscriptionsService } from '@/services/sharedSubscriptions';
import { SharedGroupCard } from './SharedGroupCard';

interface SharedGroupsDisplayProps {
  userId: string;
  onCreateGroup?: () => void;
  onSelectGroup: (group: SharedGroup) => void;
}

export const SharedGroupsDisplay: React.FC<SharedGroupsDisplayProps> = ({
  userId,
  onCreateGroup,
  onSelectGroup,
}) => {
  const [groups, setGroups] = useState<SharedGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    loadGroups();
  }, [userId]);

  const loadGroups = async () => {
    try {
      setLoading(true);
      const userGroups = await sharedSubscriptionsService.getUserSharedGroups(userId);
      setGroups(userGroups);
      
      // Load member counts for each group
      const counts: Record<string, number> = {};
      for (const group of userGroups) {
        const members = await sharedSubscriptionsService.getGroupMembers(group.id);
        counts[group.id] = members.length;
      }
      setMemberCounts(counts);
    } catch (error) {
      console.error('Failed to load shared groups:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Users size={48} color="#94A3B8" />
      <Text style={styles.emptyTitle}>No Shared Subscriptions</Text>
      <Text style={styles.emptyDescription}>
        Share your subscription costs with friends, family, or coworkers.
      </Text>
      {onCreateGroup && (
        <TouchableOpacity style={styles.createButton} onPress={onCreateGroup}>
          <Plus size={20} color="#FFFFFF" />
          <Text style={styles.createButtonText}>Create a Shared Group</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading shared groups...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Users size={20} color="#3B82F6" />
          <Text style={styles.title}>Shared Subscriptions</Text>
        </View>
        {onCreateGroup && (
          <TouchableOpacity style={styles.addButton} onPress={onCreateGroup}>
            <Plus size={20} color="#3B82F6" />
          </TouchableOpacity>
        )}
      </View>
      
      {groups.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <SharedGroupCard
              group={item}
              memberCount={memberCounts[item.id] || 0}
              onPress={() => onSelectGroup(item)}
            />
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  addButton: {
    padding: 8,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
  },
  listContent: {
    padding: 16,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 24,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  createButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#64748B',
    marginTop: 16,
  },
});