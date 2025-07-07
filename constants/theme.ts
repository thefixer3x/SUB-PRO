export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeColors {
  // Background colors
  background: string;
  backgroundSecondary: string;
  card: string;
  cardSecondary: string;
  surface: string;
  
  // Text colors
  text: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  
  // Border colors
  border: string;
  borderLight: string;
  
  // Status colors (preserve existing)
  primary: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  
  // Interactive states
  hover: string;
  pressed: string;
  selected: string;
}

export const lightTheme: ThemeColors = {
  // Background colors
  background: '#F9FAFB',
  backgroundSecondary: '#F3F4F6',
  card: '#FFFFFF',
  cardSecondary: '#F8FAFC',
  surface: '#FFFFFF',
  
  // Text colors
  text: '#1E293B',
  textSecondary: '#475569',
  textMuted: '#64748B',
  textInverse: '#FFFFFF',
  
  // Border colors
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  
  // Status colors (preserved from existing design)
  primary: '#3B82F6',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#0284C7',
  
  // Interactive states
  hover: '#F1F5F9',
  pressed: '#E2E8F0',
  selected: '#EFF6FF',
};

export const darkTheme: ThemeColors = {
  // Background colors
  background: '#0F1116',
  backgroundSecondary: '#1B1E24',
  card: '#1E2329',
  cardSecondary: '#252A32',
  surface: '#2A3039',
  
  // Text colors
  text: '#E5E7EB',
  textSecondary: '#D1D5DB',
  textMuted: '#9CA3AF',
  textInverse: '#1E293B',
  
  // Border colors
  border: '#374151',
  borderLight: '#4B5563',
  
  // Status colors (preserved with dark mode adjustments)
  primary: '#60A5FA',
  success: '#34D399',
  warning: '#FBBF24',
  error: '#F87171',
  info: '#38BDF8',
  
  // Interactive states
  hover: '#374151',
  pressed: '#4B5563',
  selected: '#1E3A8A',
};

export const themes = {
  light: lightTheme,
  dark: darkTheme,
} as const;

export type ThemeName = keyof typeof themes;

// CSS custom property names
export const cssVariables = {
  '--bg-primary': 'background',
  '--bg-secondary': 'backgroundSecondary',
  '--bg-card': 'card',
  '--bg-card-secondary': 'cardSecondary',
  '--bg-surface': 'surface',
  '--text-primary': 'text',
  '--text-secondary': 'textSecondary',
  '--text-muted': 'textMuted',
  '--text-inverse': 'textInverse',
  '--border': 'border',
  '--border-light': 'borderLight',
  '--color-primary': 'primary',
  '--color-success': 'success',
  '--color-warning': 'warning',
  '--color-error': 'error',
  '--color-info': 'info',
  '--bg-hover': 'hover',
  '--bg-pressed': 'pressed',
  '--bg-selected': 'selected',
} as const;