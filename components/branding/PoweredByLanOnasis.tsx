import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { LanOnasisLogo } from './LanOnasisLogo';
import { useTheme } from '@/contexts/ThemeContext';
import { LanOnasisColors } from '@/constants/BrandingColors';

interface PoweredByLanOnasisProps {
  variant?: 'minimal' | 'standard' | 'detailed';
  onPress?: () => void;
  style?: import('react-native').StyleProp<import('react-native').ViewStyle>;
}

export const PoweredByLanOnasis: React.FC<PoweredByLanOnasisProps> = ({
  variant = 'minimal',
  onPress,
  style,
}) => {
  const { colors, themeName } = useTheme();
  const isDark = themeName === 'dark';
  const brandColors = isDark ? LanOnasisColors.dark : LanOnasisColors;

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      // Default action - could open a link or modal
      console.log('Powered by Lan Onasis - Development Partner');
    }
  };

  if (variant === 'minimal') {
    return (
      <Pressable 
        style={[styles.minimalContainer, style]} 
        onPress={handlePress}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <LanOnasisLogo 
          variant="icon" 
          size="small"
          showText={false}
        />
        <Text style={[styles.minimalText, { color: colors.textMuted }]}>
          Powered by Lan Onasis
        </Text>
      </Pressable>
    );
  }

  if (variant === 'detailed') {
    return (
      <Pressable style={[styles.detailedContainer, style]} onPress={handlePress}>
        <LanOnasisLogo size="small" />
        <View style={styles.detailedText}>
          <Text style={[styles.partnershipText, { color: colors.text }]}>
            Development Partner
          </Text>
          <Text style={[styles.specializationText, { color: colors.textMuted }]}>
            Fintech & Mobile Solutions
          </Text>
        </View>
      </Pressable>
    );
  }

  // Standard variant
  return (
    <Pressable style={[styles.standardContainer, style]} onPress={handlePress}>
      <LanOnasisLogo 
        variant="secondary" 
        size="small"
        color={colors.textMuted}
      />
      <Text style={[styles.standardText, { color: colors.textMuted }]}>
        Development Partner
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  minimalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    opacity: 0.7,
  },
  minimalText: {
    fontSize: 11,
    marginLeft: 6,
    fontWeight: '400',
  },
  standardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
  },
  standardText: {
    fontSize: 12,
    marginLeft: 8,
    fontWeight: '500',
  },
  detailedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(27, 38, 93, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(27, 38, 93, 0.1)',
  },
  detailedText: {
    marginLeft: 12,
    flex: 1,
  },
  partnershipText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  specializationText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
});