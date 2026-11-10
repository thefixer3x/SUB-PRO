import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useSubscription } from '@/hooks/useSubscription';
import { STATUS_LABEL, type FeatureEntry } from '@/config/featureCatalog';
import type { ThemeColors } from '@/constants/theme';

interface Props {
  feature: FeatureEntry;
  /** Compact cards are used in horizontal strips. */
  compact?: boolean;
}

/**
 * One feature from the catalog: what it does, its status badge, and the one
 * honest next step. Live features open; Pro features open for paying users
 * and otherwise lead to the plans; coming-soon features have no button and
 * never show sample numbers.
 */
export function FeaturePreviewCard({ feature, compact = false }: Props) {
  const router = useRouter();
  const { colors } = useTheme();
  const { canAccessFeature } = useSubscription();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const unlocked =
    feature.status === 'live' ||
    (feature.status === 'pro' && !!feature.gate && canAccessFeature(feature.gate));

  let action: { label: string; href: string } | null = null;
  if (feature.route && unlocked) {
    action = { label: 'Open', href: feature.route };
  } else if (feature.status === 'pro') {
    action = { label: 'See plans', href: '/(tabs)/upgrade' };
  }

  const badgeLabel = feature.status === 'pro' && unlocked ? 'Included' : STATUS_LABEL[feature.status];
  const badgeStyle =
    feature.status === 'coming_soon'
      ? styles.badgeSoon
      : feature.status === 'pro' && !unlocked
        ? styles.badgePro
        : styles.badgeLive;

  return (
    <View
      style={[styles.card, compact && styles.cardCompact]}
      testID={`feature-card-${feature.id}`}
      accessibilityLabel={`${feature.title}. ${badgeLabel}. ${feature.summary}`}
    >
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={compact ? 1 : undefined}>
          {feature.title}
        </Text>
        <Text style={[styles.badge, badgeStyle]}>{badgeLabel}</Text>
      </View>
      <Text style={styles.summary} numberOfLines={compact ? 3 : undefined}>
        {feature.summary}
      </Text>
      {action && (
        <TouchableOpacity
          style={styles.action}
          onPress={() => router.push(action.href as Href)}
          accessibilityRole="button"
          accessibilityLabel={`${action.label}: ${feature.title}`}
        >
          <Text style={styles.actionText}>{action.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      marginBottom: 12,
    },
    cardCompact: {
      width: 220,
      marginBottom: 0,
      marginRight: 12,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 6,
      gap: 8,
    },
    title: {
      flex: 1,
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    badge: {
      fontSize: 11,
      fontWeight: '600',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
      overflow: 'hidden',
    },
    badgeLive: {
      color: colors.success,
      backgroundColor: colors.selected,
    },
    badgePro: {
      color: colors.primary,
      backgroundColor: colors.selected,
    },
    badgeSoon: {
      color: colors.textMuted,
      backgroundColor: colors.backgroundSecondary,
    },
    summary: {
      fontSize: 13,
      lineHeight: 18,
      color: colors.textSecondary,
    },
    action: {
      alignSelf: 'flex-start',
      marginTop: 12,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: colors.primary,
    },
    actionText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textInverse,
    },
  });
