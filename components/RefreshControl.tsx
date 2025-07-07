import React, { useCallback } from 'react';
import { RefreshControl as RNRefreshControl, Platform } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

interface CustomRefreshControlProps {
  refreshing: boolean;
  onRefresh: () => Promise<void>;
  title?: string;
  tintColor?: string;
}

export const RefreshControl: React.FC<CustomRefreshControlProps> = ({
  refreshing,
  onRefresh,
  title = 'Pull to refresh',
  tintColor,
}) => {
  const { colors } = useTheme();
  const { retryConnection } = useNetworkStatus();

  const handleRefresh = useCallback(async () => {
    // Retry network connection first if offline
    await retryConnection();
    
    // Then trigger the provided refresh function
    await onRefresh();
  }, [onRefresh, retryConnection]);

  return (
    <RNRefreshControl
      refreshing={refreshing}
      onRefresh={handleRefresh}
      tintColor={tintColor || colors.primary}
      title={title}
      titleColor={colors.textMuted}
      progressBackgroundColor={colors.card}
      colors={[colors.primary]} // Android
      // iOS specific props
      {...(Platform.OS === 'ios' && {
        progressViewOffset: 20,
      })}
      // Custom styling for enhanced experience
      style={{
        backgroundColor: 'transparent',
      }}
    />
  );
};