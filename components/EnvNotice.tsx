import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface EnvNoticeProps {
  visible?: boolean;
}

export const EnvNotice: React.FC<EnvNoticeProps> = ({ visible = false }) => {
  const { colors } = useTheme();

  // Only show in development or when explicitly visible
  if (!__DEV__ && !visible) {
    return null;
  }

  // Don't show on web in production
  if (Platform.OS === 'web' && process.env.NODE_ENV === 'production') {
    return null;
  }

  const isDevelopment = __DEV__ || process.env.NODE_ENV === 'development';
  const isWeb = Platform.OS === 'web';

  if (!isDevelopment && !isWeb) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundSecondary }]}>
      <Text style={[styles.text, { color: colors.textSecondary }]}>
        {isWeb ? 'Web Development Mode' : 'Development Mode'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingVertical: 4,
    paddingHorizontal: 8,
    alignItems: 'center',
    zIndex: 1000,
  },
  text: {
    fontSize: 12,
    fontWeight: '500',
  },
});