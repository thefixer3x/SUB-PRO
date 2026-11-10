import React from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { FeaturePreviewCard } from '@/components/features/FeaturePreviewCard';
import { PILLARS, featuresByPillar, type FeaturePillar } from '@/config/featureCatalog';
import type { ThemeColors } from '@/constants/theme';

const ORDER: FeaturePillar[] = ['see', 'decide', 'act'];

/**
 * Every SUB-PRO feature in one place, grouped by what it helps the user do.
 * Reached from Home ("Explore") and Account, so it needs no tab of its own.
 */
export default function FeaturesScreen() {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>All features</Text>
        <Text style={styles.subtitle}>
          What SUB-PRO does today, what Pro unlocks, and what is on the way.
        </Text>

        {ORDER.map((pillar) => (
          <View key={pillar} style={styles.section}>
            <Text style={styles.sectionTitle}>{PILLARS[pillar].title}</Text>
            <Text style={styles.sectionSummary}>{PILLARS[pillar].summary}</Text>
            {featuresByPillar(pillar).map((feature) => (
              <FeaturePreviewCard key={feature.id} feature={feature} />
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 20, paddingBottom: 100, width: '100%', maxWidth: 720, alignSelf: 'center' },
    title: { fontSize: 28, fontWeight: '700', color: colors.text, marginBottom: 8 },
    subtitle: { fontSize: 15, color: colors.textSecondary, marginBottom: 24, lineHeight: 21 },
    section: { marginBottom: 20 },
    sectionTitle: { fontSize: 20, fontWeight: '600', color: colors.text },
    sectionSummary: { fontSize: 14, color: colors.textMuted, marginTop: 2, marginBottom: 12 },
  });
