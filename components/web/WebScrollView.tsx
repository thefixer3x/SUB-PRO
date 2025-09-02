import React from 'react';
import { ScrollView, Platform, ViewStyle } from 'react-native';

interface WebScrollViewProps {
  children: React.ReactNode;
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
}

export const WebScrollView: React.FC<WebScrollViewProps> = ({
  children,
  style,
  contentContainerStyle,
  ...props
}) => {
  // Web-specific styles to ensure proper scrolling
  const webStyle = Platform.OS === 'web' ? {
    overflowY: 'auto' as any,
    height: '100vh',
    maxHeight: '100vh',
  } : {};

  return (
    <ScrollView
      style={[style, webStyle]}
      contentContainerStyle={[
        contentContainerStyle,
        Platform.OS === 'web' && { minHeight: '100vh' }
      ]}
      showsVerticalScrollIndicator={Platform.OS !== 'web'}
      {...props}
    >
      {children}
    </ScrollView>
  );
};