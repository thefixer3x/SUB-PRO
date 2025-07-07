import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { Share2 } from 'lucide-react-native';
import { useSubscription } from '@/hooks/useSubscription';

interface ShareButtonProps {
  onPress: () => void;
  style?: object;
  compact?: boolean;
}

export const ShareButton: React.FC<ShareButtonProps> = ({ onPress, style, compact = false }) => {
  const { canAccessFeature } = useSubscription();
  const canShare = canAccessFeature('smartInsights');

  if (!canShare) return null;

  if (compact) {
    return (
      <TouchableOpacity 
        style={[styles.compactButton, style]} 
        onPress={onPress}
        activeOpacity={0.7}
      >
        <Share2 size={16} color="#3B82F6" />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity 
      style={[styles.button, style]} 
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Share2 size={16} color="#FFFFFF" />
      <Text style={styles.text}>Share</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  compactButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
});