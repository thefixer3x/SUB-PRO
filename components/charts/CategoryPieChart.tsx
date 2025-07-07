import React, { useState, useMemo, lazy } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { TYPOGRAPHY, TEXT_COLORS, SPACING } from '@/constants/Typography';
import { ChartContainer } from './ChartContainer';

// Lazy load Recharts components
const LazyPieChart = lazy(() => import('recharts').then(module => ({ default: module.PieChart })));
const LazyPie = lazy(() => import('recharts').then(module => ({ default: module.Pie })));
const LazyCell = lazy(() => import('recharts').then(module => ({ default: module.Cell })));
const LazyTooltip = lazy(() => import('recharts').then(module => ({ default: module.Tooltip })));
const LazyLegend = lazy(() => import('recharts').then(module => ({ default: module.Legend })));
const LazyResponsiveContainer = lazy(() => import('recharts').then(module => ({ default: module.ResponsiveContainer })));

interface CategoryData {
  category: string;
  amount: number;
  percentage: number;
  color: string;
}

interface CategoryPieChartProps {
  data: CategoryData[];
  onCategoryClick?: (category: string) => void;
  title?: string;
}

const COLORS = ['#3B82F6', '#EF4444', '#8B5CF6', '#F59E0B', '#10B981', '#F97316', '#EC4899'];

export const CategoryPieChart: React.FC<CategoryPieChartProps> = ({ 
  data, 
  onCategoryClick,
  title = "Category Distribution" 
}) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  
  // Memoize chart data with enhanced properties
  const chartData = useMemo(() => {
    return data.map((item, index) => ({
      ...item,
      index,
      formattedAmount: `$${item.amount.toFixed(2)}`,
      fill: item.color || COLORS[index % COLORS.length],
    }));
  }, [data]);

  const handleMouseEnter = (_: any, index: number) => {
    setActiveIndex(index);
  };

  const handleMouseLeave = () => {
    setActiveIndex(null);
  };

  const handleClick = (data: any) => {
    onCategoryClick?.(data.category);
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <View style={styles.tooltip}>
          <Text style={styles.tooltipLabel}>{data.category}</Text>
          <Text style={styles.tooltipValue}>{data.formattedAmount}</Text>
          <Text style={styles.tooltipPercentage}>{data.percentage}% of total</Text>
        </View>
      );
    }
    return null;
  };

  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percentage }: any) => {
    if (percentage < 5) return null; // Hide labels for small slices
    
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        fontSize={12}
        fontWeight="600"
      >
        {`${percentage.toFixed(0)}%`}
      </text>
    );
  };

  if (Platform.OS !== 'web') {
    return (
      <ChartContainer height={250}>
        <Text style={styles.webOnlyMessage}>
          Interactive pie charts are available on web platform
        </Text>
        <View style={styles.fallbackList}>
          {data.map((item, index) => (
            <View key={item.category} style={styles.fallbackItem}>
              <View style={[styles.colorDot, { backgroundColor: item.color }]} />
              <Text style={styles.fallbackCategory}>{item.category}</Text>
              <Text style={styles.fallbackAmount}>${item.amount.toFixed(2)}</Text>
            </View>
          ))}
        </View>
      </ChartContainer>
    );
  }

  return (
    <ChartContainer height={300}>
      <Text style={styles.title}>{title}</Text>
      
      <LazyResponsiveContainer width="100%" height={250}>
        <LazyPieChart>
          <LazyPie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderCustomLabel}
            outerRadius={80}
            fill="#8884d8"
            dataKey="amount"
            animationBegin={0}
            animationDuration={1000}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={handleClick}
            style={{ cursor: 'pointer' }}
          >
            {chartData.map((entry, index) => (
              <LazyCell 
                key={`cell-${index}`} 
                fill={entry.fill}
                stroke={activeIndex === index ? '#1e293b' : 'none'}
                strokeWidth={activeIndex === index ? 2 : 0}
              />
            ))}
          </LazyPie>
          <LazyTooltip content={<CustomTooltip />} />
        </LazyPieChart>
      </LazyResponsiveContainer>

      {/* Custom Legend */}
      <View style={styles.legend}>
        {chartData.map((item, index) => (
          <TouchableOpacity
            key={item.category}
            style={styles.legendItem}
            onPress={() => handleClick(item)}
            accessibilityRole="button"
            accessibilityLabel={`${item.category}: ${item.formattedAmount}, ${item.percentage}%`}
          >
            <View style={[styles.legendColor, { backgroundColor: item.fill }]} />
            <Text style={styles.legendText}>{item.category}</Text>
            <Text style={styles.legendAmount}>{item.formattedAmount}</Text>
          </TouchableOpacity>
        ))}
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
  },
  tooltipLabel: {
    ...TYPOGRAPHY.label,
    color: TEXT_COLORS.primary,
    marginBottom: SPACING.xs,
  },
  tooltipValue: {
    ...TYPOGRAPHY.bodyMedium,
    color: TEXT_COLORS.primary,
    fontFamily: 'Inter-SemiBold',
  },
  tooltipPercentage: {
    ...TYPOGRAPHY.caption,
    color: TEXT_COLORS.muted,
  },
  legend: {
    marginTop: SPACING.lg,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderRadius: 6,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: SPACING.sm,
  },
  legendText: {
    ...TYPOGRAPHY.small,
    color: TEXT_COLORS.primary,
    flex: 1,
  },
  legendAmount: {
    ...TYPOGRAPHY.small,
    color: TEXT_COLORS.muted,
    fontFamily: 'Inter-SemiBold',
  },
  webOnlyMessage: {
    ...TYPOGRAPHY.bodyMedium,
    color: TEXT_COLORS.muted,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  fallbackList: {
    gap: SPACING.sm,
  },
  fallbackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: SPACING.sm,
  },
  fallbackCategory: {
    ...TYPOGRAPHY.small,
    color: TEXT_COLORS.primary,
    flex: 1,
  },
  fallbackAmount: {
    ...TYPOGRAPHY.small,
    color: TEXT_COLORS.muted,
    fontFamily: 'Inter-SemiBold',
  },
});