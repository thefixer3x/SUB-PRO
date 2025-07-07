import { useCallback } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Platform } from 'react-native';

/**
 * Hook for quick theme toggling functionality
 * Provides a simple way to toggle between light and dark themes
 */
export const useThemeToggle = () => {
  const { themeMode, themeName, toggleTheme, setThemeMode } = useTheme();

  const quickToggle = useCallback(() => {
    // Add haptic feedback for mobile platforms
    if (Platform.OS !== 'web') {
      // Note: Haptics would be imported here for mobile platforms
      // We don't implement it here since this is web-first
    }
    
    toggleTheme();
  }, [toggleTheme]);

  const setLightMode = useCallback(() => {
    setThemeMode('light');
  }, [setThemeMode]);

  const setDarkMode = useCallback(() => {
    setThemeMode('dark');
  }, [setThemeMode]);

  const setSystemMode = useCallback(() => {
    setThemeMode('system');
  }, [setThemeMode]);

  return {
    currentMode: themeMode,
    currentTheme: themeName,
    quickToggle,
    setLightMode,
    setDarkMode,
    setSystemMode,
    isLight: themeName === 'light',
    isDark: themeName === 'dark',
    isSystem: themeMode === 'system',
  };
};