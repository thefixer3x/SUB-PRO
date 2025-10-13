import React from 'react';
import { View, Image, Text, StyleSheet, Platform } from 'react-native';
import { LanOnasisColors, LogoSpecs } from '@/constants/BrandingColors';
import { useTheme } from '@/contexts/ThemeContext';

interface LanOnasisLogoProps {
  variant?: 'primary' | 'secondary' | 'icon';
  size?: 'small' | 'medium' | 'large';
  showText?: boolean;
  style?: import('react-native').StyleProp<import('react-native').ViewStyle>;
  color?: string;
}

export const LanOnasisLogo: React.FC<LanOnasisLogoProps> = ({
  variant = 'primary',
  size = 'medium',
  showText = true,
  style,
  color,
}) => {
  const { colors, themeName } = useTheme();
  const isDark = themeName === 'dark';
  const brandColors = isDark ? LanOnasisColors.dark : LanOnasisColors;
  
  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return { width: 120, height: 36 };
      case 'large':
        return { width: 200, height: 60 };
      default:
        return { width: 160, height: 48 };
    }
  };

  const getIconSize = () => {
    switch (size) {
      case 'small': return 24;
      case 'large': return 40;
      default: return 32;
    }
  };

  if (variant === 'icon') {
    return (
      <View style={[styles.iconContainer, { backgroundColor: brandColors.navy }, style]}>
        <Text style={[styles.iconL, { color: 'white' }]}>L</Text>
        <View style={styles.iconGlobe}>
          <View style={[styles.globeBase, { borderColor: 'white' }]} />
          <View style={[styles.networkNode, { backgroundColor: brandColors.green }]} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, getSizeStyles(), style]}>
      {/* Logo Icon */}
      <View style={styles.logoSection}>
        <View style={[styles.circleFrame, { borderColor: color || brandColors.navy }]}>
          <Text style={[styles.letterL, { color: color || brandColors.navy }]}>L</Text>
        </View>
        <View style={styles.globeContainer}>
          <View style={[styles.globe, { borderColor: color || brandColors.navy }]} />
          <View style={[styles.node1, { backgroundColor: brandColors.green }]} />
          <View style={[styles.node2, { backgroundColor: brandColors.gold }]} />
        </View>
      </View>

      {/* Text Section */}
      {showText && (
        <View style={styles.textSection}>
          <Text style={[styles.companyName, { color: color || colors.text }]}>
            LAN ONASIS
          </Text>
          <View style={[styles.underline, { backgroundColor: color || colors.text }]} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  logoSection: {
    position: 'relative',
    width: 48,
    height: 48,
    marginRight: 12,
  },
  circleFrame: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    position: 'absolute',
    top: 4,
    left: 4,
  },
  letterL: {
    fontSize: 24,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    position: 'absolute',
    top: 8,
    left: 12,
  },
  globeContainer: {
    position: 'absolute',
    top: 16,
    right: 0,
    width: 20,
    height: 20,
  },
  globe: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    position: 'absolute',
  },
  node1: {
    width: 4,
    height: 4,
    borderRadius: 2,
    position: 'absolute',
    top: -2,
    right: -2,
  },
  node2: {
    width: 4,
    height: 4,
    borderRadius: 2,
    position: 'absolute',
    bottom: -2,
    left: -2,
  },
  textSection: {
    flex: 1,
    alignItems: 'flex-start',
  },
  companyName: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    letterSpacing: 1,
  },
  underline: {
    height: 1,
    width: '100%',
    marginTop: 4,
  },
  // Icon variant styles
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconL: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    position: 'absolute',
    left: 6,
    top: 6,
  },
  iconGlobe: {
    position: 'absolute',
    right: 4,
    top: 4,
    width: 16,
    height: 16,
  },
  globeBase: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
  },
  networkNode: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    position: 'absolute',
    top: -1,
    right: -1,
  },
});