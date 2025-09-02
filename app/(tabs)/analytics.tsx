import React from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView } from 'react-native';
import { TrendingUp, DollarSign, Calendar } from 'lucide-react-native';
import { useSubscription } from '@/hooks/useSubscription';
import { AdBanner } from '@/components/monetization/AdBanner';
import { FeatureGate } from '@/components/monetization/FeatureGate';
import { PoweredByLanOnasis } from '@/components/branding/PoweredByLanOnasis';

export default function Analytics() {
  const { currentTier } = useSubscription();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Analytics</Text>
          <Text style={styles.subtitle}>Track your subscription spending patterns</Text>
        </View>

        {/* Basic Analytics */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <DollarSign size={24} color="#3B82F6" />
            <Text style={styles.metricValue}>$247.89</Text>
            <Text style={styles.metricLabel}>This Month</Text>
          </View>
          
          <View style={styles.metricCard}>
            <TrendingUp size={24} color="#10B981" />
            <Text style={styles.metricValue}>+5.2%</Text>
            <Text style={styles.metricLabel}>vs Last Month</Text>
          </View>
          
          <View style={styles.metricCard}>
            <Calendar size={24} color="#F59E0B" />
            <Text style={styles.metricValue}>$2,974</Text>
            <Text style={styles.metricLabel}>Annual Total</Text>
          </View>
        </View>

        <AdBanner placement="analytics" />

        {/* Basic Chart Placeholder */}
        <View style={styles.chartSection}>
          <Text style={styles.sectionTitle}>Spending Trend</Text>
          <View style={styles.chartPlaceholder}>
            <Text style={styles.chartText}>Basic spending chart available</Text>
            <Text style={styles.chartSubtext}>6 months of data</Text>
          </View>
        </View>

        {/* Advanced Analytics - Gated */}
        <FeatureGate
          feature="smartInsights"
          requiredTier="pro"
          fallback={
            <View style={styles.basicAnalytics}>
              <Text style={styles.sectionTitle}>Category Breakdown</Text>
              <View style={styles.categoryList}>
                <View style={styles.categoryItem}>
                  <View style={[styles.categoryDot, { backgroundColor: '#3B82F6' }]} />
                  <Text style={styles.categoryName}>Entertainment</Text>
                  <Text style={styles.categoryAmount}>$45.97</Text>
                </View>
                <View style={styles.categoryItem}>
                  <View style={[styles.categoryDot, { backgroundColor: '#10B981' }]} />
                  <Text style={styles.categoryName}>Productivity</Text>
                  <Text style={styles.categoryAmount}>$67.99</Text>
                </View>
                <View style={styles.categoryItem}>
                  <View style={[styles.categoryDot, { backgroundColor: '#F59E0B' }]} />
                  <Text style={styles.categoryName}>Creative</Text>
                  <Text style={styles.categoryAmount}>$29.99</Text>
                </View>
              </View>
            </View>
          }
        >
          <View style={styles.advancedAnalytics}>
            <Text style={styles.sectionTitle}>Smart Insights™</Text>
            
            <View style={styles.insightCard}>
              <Text style={styles.insightTitle}>🎯 Spending Optimization</Text>
              <Text style={styles.insightText}>
                You could save $23/month by consolidating your streaming services into family plans.
              </Text>
            </View>
            
            <View style={styles.insightCard}>
              <Text style={styles.insightTitle}>📊 Usage Analysis</Text>
              <Text style={styles.insightText}>
                Adobe Creative Cloud shows low usage (3 days this month). Consider downgrading to Photography plan.
              </Text>
            </View>
            
            <View style={styles.insightCard}>
              <Text style={styles.insightTitle}>💡 Trend Alert</Text>
              <Text style={styles.insightText}>
                Your productivity tool spending increased 40% this quarter. Budget impact: +$89/month.
              </Text>
            </View>

            <Text style={styles.sectionTitle}>Advanced Charts</Text>
            
            <View style={styles.advancedChart}>
              <Text style={styles.chartTitle}>Spending Heatmap</Text>
              <View style={styles.chartPlaceholder}>
                <Text style={styles.chartText}>Interactive heatmap showing spending patterns</Text>
                <Text style={styles.chartSubtext}>24 months of historical data</Text>
              </View>
            </View>
            
            <View style={styles.advancedChart}>
              <Text style={styles.chartTitle}>Predictive Analysis</Text>
              <View style={styles.chartPlaceholder}>
                <Text style={styles.chartText}>AI-powered spending forecasts</Text>
                <Text style={styles.chartSubtext}>12-month projection with confidence intervals</Text>
              </View>
            </View>
          </View>
        </FeatureGate>

        {currentTier === 'free' && <AdBanner placement="analytics" size="medium-rectangle" />}

        {/* Export Options */}
        <View style={styles.exportSection}>
          <Text style={styles.sectionTitle}>Export Data</Text>
          
          <FeatureGate
            feature="exportFormats"
            requiredTier="pro"
            fallback={
              <View style={styles.basicExport}>
                <Text style={styles.exportText}>Basic CSV export available</Text>
              </View>
            }
          >
            <View style={styles.exportOptions}>
              <Text style={styles.exportText}>Export in multiple formats:</Text>
              <View style={styles.exportButtons}>
                <View style={styles.exportButton}>
                  <Text style={styles.exportButtonText}>CSV</Text>
                </View>
                <View style={styles.exportButton}>
                  <Text style={styles.exportButtonText}>PDF</Text>
                </View>
                <View style={styles.exportButton}>
                  <Text style={styles.exportButtonText}>Excel</Text>
                </View>
                <View style={styles.exportButton}>
                  <Text style={styles.exportButtonText}>JSON</Text>
                </View>
              </View>
            </View>
          </FeatureGate>
        </View>

        {/* Subtle Branding Credit */}
        <View style={styles.brandingSection}>
          <PoweredByLanOnasis variant="minimal" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
  },
  metricsGrid: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 24,
    gap: 12,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 8,
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
  },
  chartSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 16,
  },
  chartPlaceholder: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chartText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1E293B',
    marginBottom: 8,
  },
  chartSubtext: {
    fontSize: 14,
    color: '#64748B',
  },
  basicAnalytics: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  categoryList: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
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
    color: '#1E293B',
  },
  categoryAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  advancedAnalytics: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  insightCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  insightText: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
  },
  advancedChart: {
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 12,
  },
  exportSection: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  basicExport: {
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  exportOptions: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  exportText: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 12,
  },
  exportButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  exportButton: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  exportButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1E293B',
  },
  brandingSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: 'center',
  },
});