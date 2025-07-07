import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { DashboardWidget as WidgetType } from '@/types/subscription';
import { TYPOGRAPHY, SPACING } from '@/constants/Typography';

interface DashboardWidgetProps {
  widget: WidgetType;
  children: React.ReactNode;
}

export function DashboardWidget({ widget, children }: DashboardWidgetProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  return (
    <View style={[styles.widget, { 
      width: widget.size.width, 
      height: widget.size.height,
      backgroundColor: colors.card,
      borderColor: colors.borderLight
    }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>{widget.title}</Text>
      </View>
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  widget: {
    borderRadius: 16,
    padding: SPACING.xl,
    marginBottom: SPACING.lg,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
  },
  header: {
    marginBottom: SPACING.lg,
  },
  title: {
    ...TYPOGRAPHY.cardHeader,
  },
  content: {
    flex: 1,
  },
});