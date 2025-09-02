import React, { useMemo, lazy } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { TYPOGRAPHY, TEXT_COLORS, SPACING } from '@/constants/Typography';
import { ChartContainer } from './ChartContainer';

// Lazy load Recharts components
const LazyScatterChart = lazy(() => import('recharts').then(module => ({ default: module.ScatterChart })));
const LazyScatter = lazy(() => import('recharts').then(module => ({ default: module.Scatter })));
const LazyXAxis = lazy(() => import('recharts').then(module => ({ default: module.XAxis })));
const LazyYAxis = lazy(() => import('recharts').then(module => ({ default: module.YAxis })));
const LazyCartesianGrid = lazy(() => import('recharts').then(module => ({ default: module.CartesianGrid })));
const LazyTooltip = lazy(() => import('recharts').then(module => ({ default: module.Tooltip })));
const LazyResponsiveContainer = lazy(() => import('recharts').then(module => ({ default: module.ResponsiveContainer })));
const LazyReferenceLine = lazy(() => import('recharts').then(module => ({ default: module.ReferenceLine })));

interface CostUsageData {
  subscriptionName: string;
  monthlyCost: number;
  usageScore: number; // 0-100 usage intensity
  category: string;
  priority: 'High' | 'Medium' | 'Low';
}

interface CostUsageScatterChartProps {
  data: CostUsageData[];
  title?: string;
}

const PRIORITY_COLORS = {
  High: '#EF4444',
  Medium: '#F59E0B', 
  Low: '#10B981',
};

const QUADRANT_LABELS = {
  topLeft: 'High Cost, Low Usage',
  topRight: 'High Cost, High Usage', 
  bottomLeft: 'Low Cost, Low Usage',
  bottomRight: 'Low Cost, High Usage',
};

export const CostUsageScatterChart: React.FC<CostUsageScatterChartProps> = ({ 
  data, 
  title = "Cost vs Usage Analysis" 
}) => {
  // Process and enhance data for visualization
  const { chartData, avgCost, avgUsage } = useMemo(() => {
    const totalCost = data.reduce((sum, item) => sum + item.monthlyCost, 0);
    const totalUsage = data.reduce((sum, item) => sum + item.usageScore, 0);
    
    const avgCost = totalCost / data.length;
    const avgUsage = totalUsage / data.length;
    
    const processedData = data.map((item, index) => ({
      ...item,
      x: item.usageScore,
      y: item.monthlyCost,
      fill: PRIORITY_COLORS[item.priority],
      quadrant: getQuadrant(item.usageScore, item.monthlyCost, avgUsage, avgCost),
      index,
    }));

    return {
      chartData: processedData,
      avgCost: avgCost,
      avgUsage: avgUsage,
    };
  }, [data]);

  function getQuadrant(usage: number, cost: number, avgUsage: number, avgCost: number): keyof typeof QUADRANT_LABELS {
    if (cost > avgCost && usage < avgUsage) return 'topLeft';
    if (cost > avgCost && usage >= avgUsage) return 'topRight';
    if (cost <= avgCost && usage < avgUsage) return 'bottomLeft';
    return 'bottomRight';
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <View style={styles.tooltip}>
          <Text style={styles.tooltipTitle}>{data.subscriptionName}</Text>
          <Text style={styles.tooltipDetail}>Cost: ${data.monthlyCost.toFixed(2)}/month</Text>
          <Text style={styles.tooltipDetail}>Usage: {data.usageScore}%</Text>
          <Text style={styles.tooltipDetail}>Category: {data.category}</Text>
          <View style={styles.priorityBadge}>
            <View style={[styles.priorityDot, { backgroundColor: data.fill }]} />
            <Text style={styles.priorityText}>{data.priority} Priority</Text>
          </View>
          <Text style={styles.quadrantLabel}>
            {QUADRANT_LABELS[data.quadrant as keyof typeof QUADRANT_LABELS]}
          </Text>
        </View>
      );
    }
    return null;
  };

  const renderQuadrantLabels = () => (
    <View style={styles.quadrantLabels}>
      <View style={styles.quadrantRow}>
        <Text style={styles.quadrantText}>High Cost{'\n'}Low Usage</Text>
        <Text style={styles.quadrantText}>High Cost{'\n'}High Usage</Text>
      </View>
      <View style={styles.quadrantRow}>
        <Text style={styles.quadrantText}>Low Cost{'\n'}Low Usage</Text>
        <Text style={styles.quadrantText}>Low Cost{'\n'}High Usage</Text>
      </View>
    </View>
  );

  if (Platform.OS !== 'web') {
    return (
      <ChartContainer height={300}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.webOnlyMessage}>
          Interactive scatter plot is available on web platform
        </Text>
        <View style={styles.fallbackList}>
          {data.slice(0, 5).map((item, index) => (
            <View key={item.subscriptionName} style={styles.fallbackItem}>
              <View style={[styles.priorityDot, { backgroundColor: PRIORITY_COLORS[item.priority] }]} />
              <View style={styles.fallbackDetails}>
                <Text style={styles.fallbackName}>{item.subscriptionName}</Text>
                <Text style={styles.fallbackMetrics}>
                  ${item.monthlyCost.toFixed(2)}/mo • {item.usageScore}% usage
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ChartContainer>
    );
  }

  return (
    <ChartContainer height={350}>
      <Text style={styles.title}>{title}</Text>
      
      <LazyResponsiveContainer width="100%" height={280}>
        <LazyScatterChart
          margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
        >
          <LazyCartesianGrid strokeDasharray="3 3" color="#f1f5f9" />
          <LazyXAxis 
            type="number"
            dataKey="x"
            name="Usage Score"
            domain={[0, 100]}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: TEXT_COLORS.muted }}
            label={{ value: 'Usage Score (%)', position: 'bottom', offset: -5 }}
          />
          <LazyYAxis 
            type="number"
            dataKey="y"
            name="Monthly Cost"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: TEXT_COLORS.muted }}
            tickFormatter={(value) => `$${value}`}
            label={{ value: 'Monthly Cost ($)', angle: -90, position: 'insideLeft' }}
          />
          <LazyTooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
          
          {/* Reference lines for quadrants */}
          <LazyReferenceLine 
            x={avgUsage} 
            color="#94a3b8" 
            strokeDasharray="5 5"
            strokeOpacity={0.7}
          />
          <LazyReferenceLine 
            y={avgCost} 
            color="#94a3b8" 
            strokeDasharray="5 5"
            strokeOpacity={0.7}
          />
          
          <LazyScatter 
            data={chartData} 
            fill="#3B82F6"
          />
        </LazyScatterChart>
      </LazyResponsiveContainer>

      {/* Legend */}
      <View style={styles.legend}>
        <Text style={styles.legendTitle}>Priority Levels</Text>
        <View style={styles.legendItems}>
          {Object.entries(PRIORITY_COLORS).map(([priority, color]) => (
            <View key={priority} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: color }]} />
              <Text style={styles.legendText}>{priority}</Text>
            </View>
          ))}
        </View>
      </View>
    </ChartContainer>
  );
};

const styles = StyleSheet.create({
  title: {
    ...TYPOGRAPHY.cardHeader,
    color: TEXT_COLORS.primary,
    marginBottom: SPACING.lg,
    textAlign: 'center',
  },
  tooltip: {
    backgroundColor: '#ffffff',
    padding: SPACING.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    minWidth: 180,
  },
  tooltipTitle: {
    ...TYPOGRAPHY.label,
    color: TEXT_COLORS.primary,
    marginBottom: SPACING.xs,
  },
  tooltipDetail: {
    ...TYPOGRAPHY.caption,
    color: TEXT_COLORS.muted,
    marginBottom: 2,
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: SPACING.xs,
  },
  priorityText: {
    ...TYPOGRAPHY.caption,
    color: TEXT_COLORS.primary,
    fontFamily: 'Inter-SemiBold',
  },
  quadrantLabel: {
    ...TYPOGRAPHY.caption,
    color: TEXT_COLORS.muted,
    fontStyle: 'italic',
  },
  legend: {
    marginTop: SPACING.lg,
    alignItems: 'center',
  },
  legendTitle: {
    ...TYPOGRAPHY.label,
    color: TEXT_COLORS.primary,
    marginBottom: SPACING.sm,
  },
  legendItems: {
    flexDirection: 'row',
    gap: SPACING.lg,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: SPACING.xs,
  },
  legendText: {
    ...TYPOGRAPHY.caption,
    color: TEXT_COLORS.muted,
  },
  quadrantLabels: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
    padding: SPACING.md,
  },
  quadrantRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quadrantText: {
    ...TYPOGRAPHY.caption,
    color: TEXT_COLORS.muted,
    textAlign: 'center',
    opacity: 0.6,
  },
  webOnlyMessage: {
    ...TYPOGRAPHY.bodyMedium,
    color: TEXT_COLORS.muted,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  fallbackList: {
    gap: SPACING.md,
  },
  fallbackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  fallbackDetails: {
    marginLeft: SPACING.sm,
    flex: 1,
  },
  fallbackName: {
    ...TYPOGRAPHY.small,
    color: TEXT_COLORS.primary,
    fontFamily: 'Inter-SemiBold',
  },
  fallbackMetrics: {
    ...TYPOGRAPHY.caption,
    color: TEXT_COLORS.muted,
  },
});