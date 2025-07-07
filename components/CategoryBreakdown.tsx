import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CategorySpend } from '@/types/subscription';

interface CategoryBreakdownProps {
  categories: CategorySpend[];
}

export const CategoryBreakdown = memo<CategoryBreakdownProps>(({ categories }) => {
  return (
    <View style={styles.container}>
      {categories.map((category, index) => (
        <View key={category.category} style={styles.categoryItem}>
          <View style={styles.categoryHeader}>
            <View style={styles.categoryInfo}>
              <View style={[styles.categoryDot, { backgroundColor: category.color }]} />
              <Text style={styles.categoryName}>{category.category}</Text>
            </View>
            <View style={styles.categoryAmount}>
              <Text style={styles.amount}>${category.amount.toFixed(2)}</Text>
              <Text style={styles.percentage}>{category.percentage}%</Text>
            </View>
          </View>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { 
                  width: `${category.percentage}%`, 
                  backgroundColor: category.color 
                }
              ]} 
            />
          </View>
        </View>
      ))}
    </View>
  );
});

CategoryBreakdown.displayName = 'CategoryBreakdown';

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  categoryItem: {
    marginBottom: 16,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  categoryName: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#1e293b',
    flex: 1,
  },
  categoryAmount: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#1e293b',
  },
  percentage: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#f1f5f9',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
});