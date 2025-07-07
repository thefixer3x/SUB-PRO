import React, { Suspense } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { SPACING } from '@/constants/Typography';

interface ChartContainerProps {
  children: React.ReactNode;
  height?: number;
  className?: string;
}

export const ChartContainer: React.FC<ChartContainerProps> = ({ 
  children, 
  height = 240,
  className 
}) => {
  const { width } = Dimensions.get('window');
  
  return (
    <View style={[styles.container, { height, width: width - (SPACING.xl * 2) }]}>
      <Suspense fallback={<View style={[styles.skeleton, { height }]} />}>
        {children}
      </Suspense>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  skeleton: {
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    marginVertical: SPACING.sm,
  },
});