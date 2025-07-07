import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeMode, ThemeName, ThemeColors, themes, cssVariables } from '@/constants/theme';

interface ThemeContextValue {
  themeMode: ThemeMode;
  themeName: ThemeName;
  colors: ThemeColors;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const THEME_STORAGE_KEY = 'app_theme_mode';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [isLoading, setIsLoading] = useState(true);

  // Determine the active theme name based on mode and system preference
  const themeName: ThemeName = themeMode === 'system' 
    ? (systemColorScheme === 'dark' ? 'dark' : 'light')
    : themeMode;

  const colors = themes[themeName];

  // Apply CSS custom properties to document root
  const applyCSSVariables = useCallback((themeColors: ThemeColors) => {
    if (typeof document !== 'undefined') {
      const root = document.documentElement || document;
      
      Object.entries(cssVariables).forEach(([cssVar, colorKey]) => {
        const colorValue = themeColors[colorKey as keyof ThemeColors] || '';
        root.style.setProperty(cssVar, colorValue);
      });
      
      // Add transition for smooth theme changes
      root.style.setProperty('color-scheme', themeName);
      if (!root.style.transition) {
        root.style.transition = 'background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease';
      }
    }
  }, [themeName]);

  // Load saved theme preference on mount
  useEffect(() => {
    const loadTheme = async () => {
      setIsLoading(true);
      try {
        const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
          setThemeModeState(savedTheme as ThemeMode);
        }
      } catch (error) {
        console.error('Failed to load theme preference:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTheme();
  }, [THEME_STORAGE_KEY]);

  // Apply CSS variables when theme changes
  useEffect(() => {
    if (!isLoading) {
      applyCSSVariables(colors);
    }
  }, [colors, isLoading, applyCSSVariables]);

  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    try {
      setThemeModeState(mode);
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode).catch(error => {
        console.warn('Failed to save theme mode:', error);
      });
    } catch (error) {
      console.error('Failed to save theme preference:', error);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    const nextMode: ThemeMode = themeName === 'light' ? 'dark' : 'light';
    setThemeMode(nextMode);
  }, [themeName, setThemeMode]);

  const value: ThemeContextValue = {
    themeMode,
    themeName,
    colors,
    setThemeMode,
    toggleTheme,
    isLoading,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Hook for accessing theme colors in StyleSheet
export const useThemeColors = (): ThemeColors => {
  const { colors } = useTheme();
  return colors;
};

// Utility function to create dynamic styles
export const createThemedStyles = <T extends Record<string, any>>(
  styleFactory: (colors: ThemeColors) => T
) => {
  return (colors: ThemeColors): T => styleFactory(colors);
};