import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TYPOGRAPHY, TEXT_COLORS, SPACING } from '@/constants/Typography';

interface ChartAccessibilityProps {
  title: string;
  description: string;
  data: any[];
  children: React.ReactNode;
  ariaLabel?: string;
}

export const ChartAccessibility: React.FC<ChartAccessibilityProps> = ({
  title,
  description,
  data,
  children,
  ariaLabel,
}) => {
  const generateDataSummary = () => {
    if (!data || data.length === 0) return 'No data available';
    
    const summary = [
      `Chart contains ${data.length} data points.`,
      description,
    ].join(' ');
    
    return summary;
  };

  return (
    <View 
      style={styles.container}
      accessible={true}
      accessibilityRole="image"
      accessibilityLabel={ariaLabel || `${title}. ${generateDataSummary()}`}
    >
      <View style={styles.visuallyHidden}>
        <Text>{title}</Text>
        <Text>{generateDataSummary()}</Text>
        {data.map((item, index) => (
          <Text key={index}>
            {JSON.stringify(item)}
          </Text>
        ))}
      </View>
      
      {children}
      
      {/* Screen reader description */}
      <Text style={styles.srOnly}>
        {generateDataSummary()}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  visuallyHidden: {
    position: 'absolute',
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: 'hidden',
    borderWidth: 0,
    opacity: 0,
  },
  srOnly: {
    ...TYPOGRAPHY.caption,
    color: 'transparent',
    position: 'absolute',
    left: -10000,
    top: 'auto',
    width: 1,
    height: 1,
    overflow: 'hidden',
  },
});