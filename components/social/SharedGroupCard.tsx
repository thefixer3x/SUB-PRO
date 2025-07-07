import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Users, Calendar, DollarSign, ChevronRight } from 'lucide-react-native';
import { SharedGroup } from '@/types/social';

interface SharedGroupCardProps {
  group: SharedGroup;
  memberCount?: number;
  onPress: () => void;
}

export const SharedGroupCard: React.FC<SharedGroupCardProps> = ({
  group,
  memberCount = 0,
  onPress,
}) => {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Users size={20} color="#3B82F6" />
          <Text style={styles.title}>{group.name}</Text>
        </View>
        <ChevronRight size={20} color="#94A3B8" />
      </View>
      
      {group.description && (
        <Text style={styles.description}>{group.description}</Text>
      )}
      
      <View style={styles.infoRow}>
        <View style={styles.infoItem}>
          <DollarSign size={16} color="#059669" />
          <Text style={styles.infoText}>${group.totalCost.toFixed(2)}/month</Text>
        </View>
        
        <View style={styles.infoItem}>
          <Users size={16} color="#64748B" />
          <Text style={styles.infoText}>{memberCount + 1} members</Text>
        </View>
        
        <View style={styles.infoItem}>
          <Calendar size={16} color="#F59E0B" />
          <Text style={styles.infoText}>
            {group.status === 'active' ? 'Active' : 
             group.status === 'pending' ? 'Pending' : 'Cancelled'}
          </Text>
        </View>
      </View>

      <View style={[styles.statusBar, 
        group.status === 'active' ? styles.statusActive :
        group.status === 'pending' ? styles.statusPending : styles.statusCancelled
      ]} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    position: 'relative',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
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
  description: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoText: {
    fontSize: 12,
    color: '#64748B',
  },
  statusBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  statusActive: {
    backgroundColor: '#10B981',
  },
  statusPending: {
    backgroundColor: '#F59E0B',
  },
  statusCancelled: {
    backgroundColor: '#EF4444',
  },
});