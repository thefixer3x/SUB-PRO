import React, { useMemo, lazy } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { TYPOGRAPHY, TEXT_COLORS, SPACING } from '@/constants/Typography';
import { ChartContainer } from './ChartContainer';

// Lazy load Recharts components for heatmap-like visualization
const LazyBarChart = lazy(() => import('recharts').then(module => ({ default: module.BarChart })));
const LazyBar = lazy(() => import('recharts').then(module => ({ default: module.Bar })));
const LazyXAxis = lazy(() => import('recharts').then(module => ({ default: module.XAxis })));
const LazyYAxis = lazy(() => import('recharts').then(module => ({ default: module.YAxis })));
const LazyTooltip = lazy(() => import('recharts').then(module => ({ default: module.Tooltip })));
const LazyResponsiveContainer = lazy(() => import('recharts').then(module => ({ default: module.ResponsiveContainer })));

interface HeatmapData {
  month: string;
  categories: { [key: string]: number };
}

interface SpendingHeatmapProps {
  data: HeatmapData[];
  title?: string;
}

const INTENSITY_COLORS = [
  '#f8fafc', '#e2e8f0', '#cbd5e1', '#94a3b8', 
  '#64748b', '#475569', '#334155', '#1e293b'
];

export const SpendingHeatmap: React.FC<SpendingHeatmapProps> = ({ 
  data, 
  title = "Annual Spending Heatmap" 
}) => {
  // Process data for heatmap visualization
  const { processedData, maxValue, categories } = useMemo(() => {
    const allCategories = new Set<string>();
    let maxVal = 0;

    // Collect all categories and find max value
    data.forEach(monthData => {
      Object.entries(monthData.categories).forEach(([category, value]) => {
        allCategories.add(category);
        maxVal = Math.max(maxVal, value);
      });
    });

    const categoriesArray = Array.from(allCategories);
    
    // Transform data for better visualization
    const processed = data.map(monthData => {
      const processedMonth: any = { month: monthData.month };
      categoriesArray.forEach(category => {
        const value = monthData.categories[category] || 0;
        processedMonth[category] = value;
        processedMonth[`${category}_intensity`] = Math.floor((value / maxVal) * (INTENSITY_COLORS.length - 1));
      });
      return processedMonth;
    });

    return {
      processedData: processed,
      maxValue: maxVal,
      categories: categoriesArray,
    };
  }, [data]);

  const getIntensityColor = (value: number, maxValue: number) => {
    const intensity = Math.floor((value / maxValue) * (INTENSITY_COLORS.length - 1));
    return INTENSITY_COLORS[intensity] || INTENSITY_COLORS[0];
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <View style={styles.tooltip}>
          <Text style={styles.tooltipLabel}>{label}</Text>
          {payload.map((entry: any, index: number) => (
            <Text key={index} style={styles.tooltipValue}>
              {entry.dataKey}: ${entry.value?.toFixed(2) || '0.00'}
            </Text>
          ))}
        </View>
      );
    }
    return null;
  };

  if (Platform.OS !== 'web') {
    return (
      <ChartContainer height={300}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.webOnlyMessage}>
          Interactive heatmap visualization is available on web platform
        </Text>
        <View style={styles.fallbackGrid}>
          {data.slice(0, 6).map((monthData, monthIndex) => (
            <View key={monthData.month} style={styles.fallbackMonth}>
              <Text style={styles.fallbackMonthLabel}>{monthData.month}</Text>
              <View style={styles.fallbackCategories}>
                {Object.entries(monthData.categories).map(([category, value]) => (
                  <View 
                    key={`${monthData.month}-${category}`}
                    style={[
                      styles.fallbackCell,
                      { backgroundColor: getIntensityColor(value, maxValue) }
                    ]}
                  >
                    <Text style={styles.fallbackCellText}>${value.toFixed(0)}</Text>
                  </View>
                ))}
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
        <LazyBarChart
          data={processedData}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
        >
          <LazyXAxis 
            dataKey="month" 
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: TEXT_COLORS.muted }}
          />
          <LazyYAxis hide />
          <LazyTooltip content={<CustomTooltip />} />
          
          {categories.map((category, index) => (
            <LazyBar
              key={category}
              dataKey={category}
              stackId="heatmap"
              fill={`hsl(${(index * 360) / categories.length}, 70%, 60%)`}
              stroke="#ffffff"
              strokeWidth={1}
            />
          ))}
        </LazyBarChart>
      </LazyResponsiveContainer>

      {/* Intensity Legend */}
      <View style={styles.legend}>
        <Text style={styles.legendTitle}>Spending Intensity</Text>
        <View style={styles.intensityScale}>
          <Text style={styles.scaleLabel}>Low</Text>
          <View style={styles.scaleColors}>
            {INTENSITY_COLORS.map((color, index) => (
              <View
                key={index}
                style={[styles.scaleColor, { backgroundColor: color }]}
              />
            ))}
          </View>
          <Text style={styles.scaleLabel}>High</Text>
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
    maxWidth: 200,
  },
  tooltipLabel: {
    ...TYPOGRAPHY.label,
    color: TEXT_COLORS.primary,
    marginBottom: SPACING.xs,
  },
  tooltipValue: {
    ...TYPOGRAPHY.caption,
    color: TEXT_COLORS.muted,
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
  intensityScale: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  scaleLabel: {
    ...TYPOGRAPHY.caption,
    color: TEXT_COLORS.muted,
  },
  scaleColors: {
    flexDirection: 'row',
  },
  scaleColor: {
    width: 16,
    height: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  webOnlyMessage: {
    ...TYPOGRAPHY.bodyMedium,
    color: TEXT_COLORS.muted,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  fallbackGrid: {
    gap: SPACING.sm,
  },
  fallbackMonth: {
    marginBottom: SPACING.md,
  },
  fallbackMonthLabel: {
    ...TYPOGRAPHY.label,
    color: TEXT_COLORS.primary,
    marginBottom: SPACING.xs,
  },
  fallbackCategories: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  fallbackCell: {
    padding: SPACING.xs,
    borderRadius: 4,
    minWidth: 50,
    alignItems: 'center',
  },
  fallbackCellText: {
    ...TYPOGRAPHY.caption,
    color: TEXT_COLORS.primary,
    fontFamily: 'Inter-SemiBold',
  },
});