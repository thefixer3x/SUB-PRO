import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { ExternalLink } from 'lucide-react-native';
import { Partner } from '@/types/partner';

interface PartnerCardProps {
  partner: Partner;
  onPress: () => void;
}

export const PartnerCard: React.FC<PartnerCardProps> = ({ partner, onPress }) => {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <Image 
        source={{ uri: partner.logo }} 
        style={styles.logo} 
        resizeMode="cover"
      />
      <View style={styles.content}>
        <Text style={styles.name}>{partner.name}</Text>
        <Text style={styles.benefit} numberOfLines={2}>{partner.benefit}</Text>
        <View style={styles.viewDealContainer}>
          <Text style={styles.viewDeal}>View Deal</Text>
          <ExternalLink size={14} color="#3B82F6" />
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    width: '48%', // Almost half the width to allow for margins
  },
  logo: {
    width: '100%',
    height: 120,
    backgroundColor: '#F8FAFC', // Placeholder color
  },
  content: {
    padding: 16,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  benefit: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 12,
    lineHeight: 18,
  },
  viewDealContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewDeal: {
    fontSize: 14,
    fontWeight: '500',
    color: '#3B82F6',
    marginRight: 4,
  },
});