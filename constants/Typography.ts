import { TextStyle } from 'react-native';
import { useThemeColors } from '@/contexts/ThemeContext';

// Typography Scale
export const FONT_SIZES = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
} as const;

export const FONT_WEIGHTS = {
  regular: '400' as TextStyle['fontWeight'],
  medium: '500' as TextStyle['fontWeight'],
  semibold: '600' as TextStyle['fontWeight'],
  bold: '700' as TextStyle['fontWeight'],
} as const;

export const LINE_HEIGHTS = {
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.6,
} as const;

// Typography Tokens
export const TYPOGRAPHY = {
  // Page Titles
  pageTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: FONT_SIZES['2xl'],
    lineHeight: FONT_SIZES['2xl'] * LINE_HEIGHTS.tight,
    fontWeight: FONT_WEIGHTS.semibold,
  },
  
  // Card Headers
  cardHeader: {
    fontFamily: 'Poppins-Medium',
    fontSize: FONT_SIZES.lg,
    lineHeight: FONT_SIZES.lg * LINE_HEIGHTS.normal,
    fontWeight: FONT_WEIGHTS.medium,
  },
  
  // Section Headers
  sectionHeader: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: FONT_SIZES.lg,
    lineHeight: FONT_SIZES.lg * LINE_HEIGHTS.normal,
    fontWeight: FONT_WEIGHTS.semibold,
  },
  
  // Body Text
  body: {
    fontFamily: 'Inter-Regular',
    fontSize: FONT_SIZES.base,
    lineHeight: FONT_SIZES.base * LINE_HEIGHTS.normal,
    fontWeight: FONT_WEIGHTS.regular,
  },
  
  // Body Medium
  bodyMedium: {
    fontFamily: 'Inter-Medium',
    fontSize: FONT_SIZES.base,
    lineHeight: FONT_SIZES.base * LINE_HEIGHTS.normal,
    fontWeight: FONT_WEIGHTS.medium,
  },
  
  // Labels & Helper Text
  label: {
    fontFamily: 'Inter-Medium',
    fontSize: FONT_SIZES.sm,
    lineHeight: FONT_SIZES.sm * LINE_HEIGHTS.normal,
    fontWeight: FONT_WEIGHTS.medium,
  },
  
  // Small Text
  small: {
    fontFamily: 'Inter-Regular',
    fontSize: FONT_SIZES.sm,
    lineHeight: FONT_SIZES.sm * LINE_HEIGHTS.normal,
    fontWeight: FONT_WEIGHTS.regular,
  },
  
  // Caption
  caption: {
    fontFamily: 'Inter-Regular',
    fontSize: FONT_SIZES.xs,
    lineHeight: FONT_SIZES.xs * LINE_HEIGHTS.normal,
    fontWeight: FONT_WEIGHTS.regular,
  },
  
  // Buttons
  button: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FONT_SIZES.sm,
    lineHeight: FONT_SIZES.sm * LINE_HEIGHTS.tight,
    fontWeight: FONT_WEIGHTS.semibold,
  },
  
  // Large Button
  buttonLarge: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FONT_SIZES.base,
    lineHeight: FONT_SIZES.base * LINE_HEIGHTS.tight,
    fontWeight: FONT_WEIGHTS.semibold,
  },
  
  // Input Text
  input: {
    fontFamily: 'Inter-Regular',
    fontSize: FONT_SIZES.base,
    lineHeight: FONT_SIZES.base * LINE_HEIGHTS.normal,
    fontWeight: FONT_WEIGHTS.regular,
  },
  
  // Metrics/Numbers
  metric: {
    fontFamily: 'Poppins-Bold',
    fontSize: FONT_SIZES['2xl'],
    lineHeight: FONT_SIZES['2xl'] * LINE_HEIGHTS.tight,
    fontWeight: FONT_WEIGHTS.bold,
  },
  
  // Large Metrics
  metricLarge: {
    fontFamily: 'Poppins-Bold',
    fontSize: FONT_SIZES['3xl'],
    lineHeight: FONT_SIZES['3xl'] * LINE_HEIGHTS.tight,
    fontWeight: FONT_WEIGHTS.bold,
  },
} as const;

// Color Tokens for High Contrast
export const getTextColors = () => {
  // For web platform, we can use CSS variables
  if (typeof window !== 'undefined') {
    return {
      primary: 'var(--text-primary)',
      secondary: 'var(--text-secondary)',
      muted: 'var(--text-muted)',
      inverse: 'var(--text-inverse)',
      error: 'var(--color-error)',
      success: 'var(--color-success)',
      warning: 'var(--color-warning)',
      info: 'var(--color-info)',
    };
  }
  
  // Fallback for non-web platforms - use hook in components
  return {
    primary: '#1e293b',
    secondary: '#475569',
    muted: '#64748b',
    inverse: '#ffffff',
    error: '#dc2626',
    success: '#059669',
    warning: '#d97706',
    info: '#0284c7',
  };
};

// Legacy export for backward compatibility
export const TEXT_COLORS = {
  primary: '#1e293b',      // High contrast for primary text
  secondary: '#475569',    // Medium contrast for secondary text
  muted: '#64748b',       // Lower contrast for helper text
  inverse: '#ffffff',     // White text for dark backgrounds
  error: '#dc2626',       // Error text
  success: '#059669',     // Success text
  warning: '#d97706',     // Warning text
  info: '#0284c7',        // Info text
} as const;

// Hook for using theme-aware text colors in components
export const useTextColors = () => {
  if (typeof window !== 'undefined') {
    return getTextColors();
  }
  
  const themeColors = useThemeColors();
  return {
    primary: themeColors.text,
    secondary: themeColors.textSecondary,
    muted: themeColors.textMuted,
    inverse: themeColors.textInverse,
    error: themeColors.error,
    success: themeColors.success,
    warning: themeColors.warning,
    info: themeColors.info,
  };
};

// Utility function to get theme-aware background colors
export const useBackgroundColors = () => {
  if (typeof window !== 'undefined') {
    return {
      primary: 'var(--bg-primary)',
      secondary: 'var(--bg-secondary)',
      card: 'var(--bg-card)',
      cardSecondary: 'var(--bg-card-secondary)',
      surface: 'var(--bg-surface)',
      hover: 'var(--bg-hover)',
      pressed: 'var(--bg-pressed)',
      selected: 'var(--bg-selected)',
    };
  }
  
  const themeColors = useThemeColors();
  return {
    primary: themeColors.background,
    secondary: themeColors.backgroundSecondary,
    card: themeColors.card,
    cardSecondary: themeColors.cardSecondary,
    surface: themeColors.surface,
    hover: themeColors.hover,
    pressed: themeColors.pressed,
    selected: themeColors.selected,
  };
};

// Spacing tokens for consistent typography
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
} as const;