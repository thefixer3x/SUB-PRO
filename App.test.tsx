// Simple test to check if basic React Native Web works
import React from 'react';
import { View, Text } from 'react-native';

export default function TestApp() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f0f0' }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>Basic React Native Web Test</Text>
      <Text style={{ marginTop: 10 }}>If you can see this, React Native Web is working</Text>
    </View>
  );
}