import React from 'react';
import { View, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { SPACING } from '@/constants/Typography';

interface ChartGridProps {
  children: React.ReactNode[];
  columns?: 1 | 2;
  gap?: number;
}

export const ChartGrid: React.FC<ChartGridProps> = ({ 
  children, 
  columns = 2,
  gap = SPACING.lg 
}) => {
  const { width: screenWidth } = Dimensions.get('window');
  const isMobile = screenWidth < 640;
  
  // Force single column on mobile
  const actualColumns = isMobile ? 1 : columns;
  const containerWidth = screenWidth - (SPACING.xl * 2);
  const itemWidth = actualColumns === 1 
    ? containerWidth 
    : (containerWidth - gap) / 2;

  const renderGrid = () => {
    if (actualColumns === 1) {
      return (
        <View style={[styles.singleColumn, { gap }]}>
          {children.map((child, index) => (
            <View key={index} style={[styles.gridItem, { width: itemWidth }]}>
              {child}
            </View>
          ))}
        </View>
      );
    }

    // Two column layout
    const rows: React.ReactNode[][] = [];
    for (let i = 0; i < children.length; i += 2) {
      rows.push(children.slice(i, i + 2));
    }

    return (
      <View style={[styles.grid, { gap }]}>
        {rows.map((row, rowIndex) => (
          <View key={rowIndex} style={[styles.gridRow, { gap }]}>
            {row.map((child, colIndex) => (
              <View key={colIndex} style={[styles.gridItem, { width: itemWidth }]}>
                {child}
              </View>
            ))}
          </View>
        ))}
      </View>
    );
  };

  return (
    <ScrollView 
      style={styles.container}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.contentContainer}
    >
      {renderGrid()}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING['2xl'],
  },
  grid: {
    flex: 1,
  },
  gridRow: {
    flexDirection: 'row',
    marginBottom: SPACING.lg,
  },
  gridItem: {
    flex: 1,
  },
  singleColumn: {
    flex: 1,
  },
});