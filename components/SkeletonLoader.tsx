import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
} from 'react-native-reanimated';

interface SkeletonLoaderProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  width = '100%',
  height = 20,
  borderRadius = 8,
  style,
}) => {
  const opacity = useSharedValue(0.8);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 1000 }),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
        },
        animatedStyle,
        style,
      ]}
    />
  );
};

export const SkeletonCard: React.FC = () => (
  <View style={styles.card}>
    <View style={styles.cardHeader}>
      <View style={styles.serviceInfo}>
        <SkeletonLoader width={16} height={16} borderRadius={8} />
        <View style={styles.serviceText}>
          <SkeletonLoader width={120} height={18} />
          <View style={styles.planSkeleton}>
            <SkeletonLoader width={80} height={14} />
          </View>
        </View>
      </View>
      <View style={styles.statusContainer}>
        <SkeletonLoader width={60} height={24} borderRadius={12} />
        <View style={styles.prioritySkeleton}>
          <SkeletonLoader width={50} height={18} borderRadius={8} />
        </View>
      </View>
    </View>
    <View style={styles.details}>
      <SkeletonLoader width={100} height={20} />
      <View style={styles.detailSkeleton}>
        <SkeletonLoader width={150} height={14} />
      </View>
      <View style={styles.detailSkeleton}>
        <SkeletonLoader width={120} height={14} />
      </View>
    </View>
  </View>
);

export const SkeletonMetric: React.FC = () => (
  <View style={styles.metricCard}>
    <SkeletonLoader width={48} height={48} borderRadius={24} style={styles.iconSkeleton} />
    <SkeletonLoader width={80} height={24} style={styles.valueSkeleton} />
    <SkeletonLoader width={100} height={12} />
  </View>
);

export const SkeletonChart: React.FC = () => (
  <View style={styles.chartContainer}>
    <SkeletonLoader width={180} height={18} style={styles.chartTitle} />
    <View style={styles.chart}>
      {[1, 2, 3, 4, 5, 6].map((item) => (
        <View key={item} style={styles.barContainer}>
          <SkeletonLoader width={40} height={Math.random() * 150 + 50} borderRadius={4} />
          <SkeletonLoader width={30} height={12} style={styles.barLabel} />
        </View>
      ))}
    </View>
  </View>
);

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#f1f5f9',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  serviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  serviceText: {
    flex: 1,
    marginLeft: 12,
  },
  planSkeleton: {
    marginTop: 4,
  },
  statusContainer: {
    alignItems: 'flex-end',
  },
  prioritySkeleton: {
    marginTop: 4,
  },
  details: {
    gap: 8,
  },
  detailSkeleton: {
    marginTop: 4,
  },
  metricCard: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  iconSkeleton: {
    marginBottom: 12,
  },
  valueSkeleton: {
    marginBottom: 4,
  },
  chartContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  chartTitle: {
    marginBottom: 20,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 200,
  },
  barContainer: {
    alignItems: 'center',
    flex: 1,
  },
  barLabel: {
    marginTop: 8,
  },
});