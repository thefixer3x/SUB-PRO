import React, { useState, useMemo, lazy } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { TYPOGRAPHY, TEXT_COLORS, SPACING } from '@/constants/Typography';
import { ChartContainer } from './ChartContainer';

// Lazy load Recharts for code splitting
const LazyLineChart = lazy(() => import('recharts').then(module => ({ default: module.LineChart })));
const LazyLine = lazy(() => import('recharts').then(module => ({ default: module.Line })));
const LazyXAxis = lazy(() => import('recharts').then(module => ({ default: module.XAxis })));
const LazyYAxis = lazy(() => import('recharts').then(module => ({ default: module.YAxis })));
const LazyCartesianGrid = lazy(() => import('recharts').then(module => ({ default: module.CartesianGrid })));
const LazyTooltip = lazy(() => import('recharts').then(module => ({ default: module.Tooltip })));
const LazyBrush = lazy(() => import('recharts').then(module => ({ default: module.Brush })));
const LazyResponsiveContainer = lazy(() => import('recharts').then(module => ({ default: module.ResponsiveContainer })));

interface SpendingData {
  month: string;
  amount: number;
  subscriptions: number;
  year?: number;
}

interface SpendingTrendChartProps {
  data: SpendingData[];
  title?: string;
}

export const SpendingTrendChart: React.FC<SpendingTrendChartProps> = ({ 
  data, 
  title = "Spending Trend Analysis" 
}) => {
  const [timeframe, setTimeframe] = useState<'month' | 'year'>('month');
  
  // Memoize processed data for performance
  const chartData = useMemo(() => {
    return data.map((item, index) => ({
      ...item,
      index,
      formattedAmount: `$${item.amount.toFixed(2)}`,
    }));
  }, [data]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <View style={styles.tooltip}>
          <Text style={styles.tooltipLabel}>{label}</Text>
          <Text style={styles.tooltipValue}>
            Amount: {payload[0].payload.formattedAmount}
          </Text>
          <Text style={styles.tooltipSubs}>
            Subscriptions: {payload[0].payload.subscriptions}
          </Text>
        </View>
      );
    }
    return null;
  };

  if (Platform.OS !== 'web') {
    return (
      <ChartContainer>
        <Text style={styles.webOnlyMessage}>
          Interactive charts are available on web platform
        </Text>
      </ChartContainer>
    );
  }

  return (
    <ChartContainer height={280}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[styles.toggle, timeframe === 'month' && styles.toggleActive]}
            onPress={() => setTimeframe('month')}
          >
            <Text style={[styles.toggleText, timeframe === 'month' && styles.toggleTextActive]}>
              Month
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggle, timeframe === 'year' && styles.toggleActive]}
            onPress={() => setTimeframe('year')}
          >
            <Text style={[styles.toggleText, timeframe === 'year' && styles.toggleTextActive]}>
              Year
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      
      <LazyResponsiveContainer width="100%" height={200}>
        <LazyLineChart
          data={chartData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <LazyCartesianGrid strokeDasharray="3 3" color="#f1f5f9" />
          <LazyXAxis 
            dataKey="month" 
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: TEXT_COLORS.muted }}
          />
          <LazyYAxis 
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: TEXT_COLORS.muted }}
            tickFormatter={(value) => `$${value}`}
          />
          <LazyTooltip content={<CustomTooltip />} />
          <LazyBrush dataKey="month" height={30} color="#3B82F6" />
          <LazyLine 
            type="monotone" 
            dataKey="amount" 
            color="#3B82F6" 
            strokeWidth={3}
            dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, fill: '#3B82F6' }}
            animationDuration={1000}
          />
        </LazyLineChart>
      </LazyResponsiveContainer>
    </ChartContainer>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  title: {
    ...TYPOGRAPHY.cardHeader,
    color: TEXT_COLORS.primary,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 2,
  },
  toggle: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: 6,
  },
  toggleActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleText: {
    ...TYPOGRAPHY.caption,
    color: TEXT_COLORS.muted,
  },
  toggleTextActive: {
    color: TEXT_COLORS.primary,
    fontFamily: 'Inter-SemiBold',
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
  },
  tooltipLabel: {
    ...TYPOGRAPHY.label,
    color: TEXT_COLORS.primary,
    marginBottom: SPACING.xs,
  },
  tooltipValue: {
    ...TYPOGRAPHY.small,
    color: TEXT_COLORS.primary,
    fontFamily: 'Inter-SemiBold',
  },
  tooltipSubs: {
    ...TYPOGRAPHY.caption,
    color: TEXT_COLORS.muted,
  },
  webOnlyMessage: {
    ...TYPOGRAPHY.bodyMedium,
    color: TEXT_COLORS.muted,
    textAlign: 'center',
    marginTop: SPACING['2xl'],
  },
});