import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Sun, Moon, Monitor } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeMode } from '@/constants/theme';
import { TYPOGRAPHY, SPACING } from '@/constants/Typography';
import { FEATURE_FLAGS } from '@/config/featureFlags';

interface ThemeSelectorProps {
  showLabels?: boolean;
  compact?: boolean;
}

const themeOptions: {
  mode: ThemeMode;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    mode: 'system',
    label: 'System',
    description: 'Matches your device settings',
    icon: <Monitor size={20} />,
  },
  {
    mode: 'light',
    label: 'Light',
    description: 'Light appearance',
    icon: <Sun size={20} />,
  },
  {
    mode: 'dark',
    label: 'Dark',
    description: 'Dark appearance',
    icon: <Moon size={20} />,
  },
];

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({ 
  showLabels = true,
  compact = false 
}) => {
  const { themeMode, setThemeMode, colors } = useTheme();

  // Don't render if dark mode feature is disabled
  if (!FEATURE_FLAGS.DARK_MODE) {
    return null;
  }

  const styles = createStyles(colors, compact);

  const handleThemeChange = (mode: ThemeMode) => {
    setThemeMode(mode);
  };

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        {themeOptions.map((option) => (
          <TouchableOpacity
            key={option.mode}
            style={[
              styles.compactButton,
              themeMode === option.mode && styles.compactButtonActive,
            ]}
            onPress={() => handleThemeChange(option.mode)}
            accessibilityRole="button"
            accessibilityLabel={`${option.label} theme`}
            accessibilityState={{ selected: themeMode === option.mode }}
          >
            <View style={[
              styles.compactIcon,
              themeMode === option.mode && styles.compactIconActive,
            ]}>
              {React.cloneElement(option.icon as React.ReactElement<any>, {
                color: themeMode === option.mode ? colors.primary : colors.textMuted,
              })}
            </View>
            {showLabels && (
              <Text style={[
                styles.compactLabel,
                themeMode === option.mode && styles.compactLabelActive,
              ]}>
                {option.label}
              </Text>
            )}
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {showLabels && (
        <>
          <Text style={styles.sectionTitle}>Appearance</Text>
          <Text style={styles.betaNote}>
            🚧 Currently applies to settings page only. Full app theming coming in next update.
          </Text>
        </>
      )}
      <View style={styles.optionsContainer}>
        {themeOptions.map((option) => (
          <TouchableOpacity
            key={option.mode}
            style={[
              styles.option,
              themeMode === option.mode && styles.optionActive,
            ]}
            onPress={() => handleThemeChange(option.mode)}
            accessibilityRole="button"
            accessibilityLabel={`${option.label} theme: ${option.description}`}
            accessibilityState={{ selected: themeMode === option.mode }}
          >
            <View style={styles.optionContent}>
              <View style={[
                styles.iconContainer,
                themeMode === option.mode && styles.iconContainerActive,
              ]}>
                {React.cloneElement(option.icon as React.ReactElement<any>, {
                  color: themeMode === option.mode ? colors.primary : colors.textMuted,
                })}
              </View>
              <View style={styles.textContainer}>
                <Text style={[
                  styles.optionLabel,
                  themeMode === option.mode && styles.optionLabelActive,
                ]}>
                  {option.label}
                </Text>
                <Text style={styles.optionDescription}>
                  {option.description}
                </Text>
              </View>
              {themeMode === option.mode && (
                <View style={styles.selectedIndicator} />
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const createStyles = (colors: any, compact: boolean) => StyleSheet.create({
  container: {
    marginBottom: SPACING['2xl'],
  },
  sectionTitle: {
    ...TYPOGRAPHY.label,
    color: colors.text,
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.xl,
  },
  betaNote: {
    ...TYPOGRAPHY.small,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    lineHeight: 16,
  },
  optionsContainer: {
    backgroundColor: colors.card,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  option: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  optionActive: {
    backgroundColor: colors.selected,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.lg,
  },
  iconContainerActive: {
    backgroundColor: colors.primary + '20',
  },
  textContainer: {
    flex: 1,
  },
  optionLabel: {
    ...TYPOGRAPHY.bodyMedium,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
    marginBottom: 2,
  },
  optionLabelActive: {
    color: colors.primary,
  },
  optionDescription: {
    ...TYPOGRAPHY.small,
    color: colors.textMuted,
  },
  selectedIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Compact styles
  compactContainer: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 12,
    padding: 3,
  },
  compactButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: 9,
    gap: SPACING.xs,
  },
  compactButtonActive: {
    backgroundColor: colors.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  compactIcon: {
    // No additional styles needed, handled by color prop
  },
  compactIconActive: {
    // No additional styles needed, handled by color prop
  },
  compactLabel: {
    ...TYPOGRAPHY.caption,
    color: colors.textMuted,
  },
  compactLabelActive: {
    color: colors.text,
    fontFamily: 'Inter-SemiBold',
  },
});