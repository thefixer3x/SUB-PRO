import React from 'react';
import { render } from '@testing-library/react-native';
import { View, Text } from 'react-native';

const TestApp = () => {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f0f0' }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>Basic React Native Web Test</Text>
      <Text style={{ marginTop: 10 }}>If you can see this, React Native Web is working</Text>
    </View>
  );
};

describe('App', () => {
  it('renders basic components correctly', () => {
    const { getByText } = render(<TestApp />);
    expect(getByText('Basic React Native Web Test')).toBeTruthy();
    expect(getByText('If you can see this, React Native Web is working')).toBeTruthy();
  });
});
