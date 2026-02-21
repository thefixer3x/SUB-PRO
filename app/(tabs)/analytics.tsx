import React from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView } from 'react-native';
import { TrendingUp, DollarSign, Calendar } from 'lucide-react-native';
import { useSubscription } from '@/hooks/useSubscription';
import { AdBanner } from '@/components/monetization/AdBanner';
import { FeatureGate } from '@/components/monetization/FeatureGate';
import { PoweredByLanOnasis } from '@/components/branding/PoweredByLanOnasis';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors } from '@/constants/theme';

export default function Analytics() {
  const { currentTier } = useSubscription();
  const { colors } = useTheme();
  const dynamicStyles = React.useMemo(() => createStyles(colors), [colors]);

  return (
    <SafeAreaView style={dynamicStyles.container}>
      <ScrollView style={dynamicStyles.content} showsVerticalScrollIndicator={false} contentContainerStyle={dynamicStyles.scrollContent}>
        <View style={dynamicStyles.header}>
          <Text style={dynamicStyles.title}>Analytics</Text>
          <Text style={dynamicStyles.subtitle}>Track your subscription spending patterns</Text>
        </View>

        <View style={dynamicStyles.metricsGrid}>
          <View style={dynamicStyles.metricCard}>
            <DollarSign size={24} color={colors.primary} />
            <Text style={dynamicStyles.metricValue}>$247.89</Text>
            <Text style={dynamicStyles.metricLabel}>This Month</Text>
          </View>
          
          <View style={dynamicStyles.metricCard}>
            <TrendingUp size={24} color={colors.success} />
            <Text style={dynamicStyles.metricValue}>+5.2%</Text>
            <Text style={dynamicStyles.metricLabel}>vs Last Month</Text>
          </View>
          
          <View style={dynamicStyles.metricCard}>
            <Calendar size={24} color={colors.warning} />
            <Text style={dynamicStyles.metricValue}>$2,974</Text>
            <Text style={dynamicStyles.metricLabel}>Annual Total</Text>
          </View>
        </View>

        <AdBanner placement="analytics" />

        <View style={dynamicStyles.chartSection}>
          <Text style={dynamicStyles.sectionTitle}>Spending Trend</Text>
          <View style={dynamicStyles.chartPlaceholder}>
            <Text style={dynamicStyles.chartText}>Basic spending chart available</Text>
            <Text style={dynamicStyles.chartSubtext}>6 months of data</Text>
          </View>
        </View>

        <FeatureGate
          feature="smartInsights"
          requiredTier="pro"
          fallback={
            <View style={dynamicStyles.basicAnalytics}>
              <Text style={dynamicStyles.sectionTitle}>Category Breakdown</Text>
              <View style={dynamicStyles.categoryList}>
                <View style={dynamicStyles.categoryItem}>
                  <View style={[dynamicStyles.categoryDot, { backgroundColor: colors.primary }]} />
                  <Text style={dynamicStyles.categoryName}>Entertainment</Text>
                  <Text style={dynamicStyles.categoryAmount}>$45.97</Text>
                </View>
                <View style={dynamicStyles.categoryItem}>
                  <View style={[dynamicStyles.categoryDot, { backgroundColor: colors.success }]} />
                  <Text style={dynamicStyles.categoryName}>Productivity</Text>
                  <Text style={dynamicStyles.categoryAmount}>$67.99</Text>
                </View>
                <View style={dynamicStyles.categoryItem}>
                  <View style={[dynamicStyles.categoryDot, { backgroundColor: colors.warning }]} />
                  <Text style={dynamicStyles.categoryName}>Creative</Text>
                  <Text style={dynamicStyles.categoryAmount}>$29.99</Text>
                </View>
              </View>
            </View>
          }
        >
          <View style={dynamicStyles.advancedAnalytics}>
            <Text style={dynamicStyles.sectionTitle}>Smart Insights</Text>
            
            <View style={dynamicStyles.insightCard}>
              <Text style={dynamicStyles.insightTitle}>Spending Optimization</Text>
              <Text style={dynamicStyles.insightText}>
                You could save $23/month by consolidating your streaming services into family plans.
              </Text>
            </View>
            
            <View style={dynamicStyles.insightCard}>
              <Text style={dynamicStyles.insightTitle}>Usage Analysis</Text>
              <Text style={dynamicStyles.insightText}>
                Adobe Creative Cloud shows low usage (3 days this month). Consider downgrading to Photography plan.
              </Text>
            </View>
            
            <View style={dynamicStyles.insightCard}>
              <Text style={dynamicStyles.insightTitle}>Trend Alert</Text>
              <Text style={dynamicStyles.insightText}>
                Your productivity tool spending increased 40% this quarter. Budget impact: +$89/month.
              </Text>
            </View>

            <Text style={dynamicStyles.sectionTitle}>Advanced Charts</Text>
            
            <View style={dynamicStyles.advancedChart}>
              <Text style={dynamicStyles.chartTitle}>Spending Heatmap</Text>
              <View style={dynamicStyles.chartPlaceholder}>
                <Text style={dynamicStyles.chartText}>Interactive heatmap showing spending patterns</Text>
                <Text style={dynamicStyles.chartSubtext}>24 months of historical data</Text>
              </View>
            </View>
            
            <View style={dynamicStyles.advancedChart}>
              <Text style={dynamicStyles.chartTitle}>Predictive Analysis</Text>
              <View style={dynamicStyles.chartPlaceholder}>
                <Text style={dynamicStyles.chartText}>AI-powered spending forecasts</Text>
                <Text style={dynamicStyles.chartSubtext}>12-month projection with confidence intervals</Text>
              </View>
            </View>
          </View>
        </FeatureGate>

        {currentTier === 'free' && <AdBanner placement="analytics" size="medium-rectangle" />}

        <View style={dynamicStyles.exportSection}>
          <Text style={dynamicStyles.sectionTitle}>Export Data</Text>
          
          <FeatureGate
            feature="exportFormats"
            requiredTier="pro"
            fallback={
              <View style={dynamicStyles.basicExport}>
                <Text style={dynamicStyles.exportText}>Basic CSV export available</Text>
              </View>
            }
          >
            <View style={dynamicStyles.exportOptions}>
              <Text style={dynamicStyles.exportText}>Export in multiple formats:</Text>
              <View style={dynamicStyles.exportButtons}>
                <View style={dynamicStyles.exportButton}>
                  <Text style={dynamicStyles.exportButtonText}>CSV</Text>
                </View>
                <View style={dynamicStyles.exportButton}>
                  <Text style={dynamicStyles.exportButtonText}>PDF</Text>
                </View>
                <View style={dynamicStyles.exportButton}>
                  <Text style={dynamicStyles.exportButtonText}>Excel</Text>
                </View>
                <View style={dynamicStyles.exportButton}>
                  <Text style={dynamicStyles.exportButtonText}>JSON</Text>
                </View>
              </View>
            </View>
          </FeatureGate>
        </View>

        <View style={dynamicStyles.brandingSection}>
          <PoweredByLanOnasis variant="minimal" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  metricsGrid: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 24,
    gap: 12,
  },
  metricCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginTop: 8,
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
  },
  chartSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  chartPlaceholder: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  chartText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 8,
  },
  chartSubtext: {
    fontSize: 14,
    color: colors.textMuted,
  },
  basicAnalytics: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  categoryList: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  categoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  categoryName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  categoryAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  advancedAnalytics: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  insightCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  insightText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  advancedChart: {
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  exportSection: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  basicExport: {
    backgroundColor: colors.cardSecondary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  exportOptions: {
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  exportText: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 12,
  },
  exportButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  exportButton: {
    backgroundColor: colors.backgroundSecondary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  exportButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.text,
  },
  brandingSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: 'center',
  },
});
