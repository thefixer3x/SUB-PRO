import React from 'react';
import { View, Text } from 'react-native';

export default function TestPage() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>Test Page</Text>
      <Text>This is a test page to verify routing works</Text>
    </View>
  );
}