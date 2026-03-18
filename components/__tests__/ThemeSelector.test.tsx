import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ThemeSelector } from '../ThemeSelector';
import { ThemeProvider } from '@/contexts/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
}));

// Mock useColorScheme
jest.mock('react-native', () => ({
  ...jest.requireActual('react-native'),
  useColorScheme: () => 'light',
}));

const ThemeSelectorWithProvider = (props: any) => (
  <ThemeProvider>
    <ThemeSelector {...props} />
  </ThemeProvider>
);

describe('ThemeSelector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all theme options', async () => {
    const { getByText } = render(<ThemeSelectorWithProvider />);
    
    expect(getByText('System')).toBeTruthy();
    expect(getByText('Light')).toBeTruthy();
    expect(getByText('Dark')).toBeTruthy();
  });

  it('shows descriptions for each theme option', async () => {
    const { getByText } = render(<ThemeSelectorWithProvider />);
    
    expect(getByText('Matches your device settings')).toBeTruthy();
    expect(getByText('Light appearance')).toBeTruthy();
    expect(getByText('Dark appearance')).toBeTruthy();
  });

  it('changes theme when option is selected', async () => {
    const { getByText } = render(<ThemeSelectorWithProvider />);
    
    const darkOption = getByText('Dark');
    fireEvent.press(darkOption);
    
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('app_theme_mode', 'dark');
  });

  it('renders in compact mode', async () => {
    const { getByText } = render(<ThemeSelectorWithProvider compact />);
    
    // Should still show all options but in compact layout
    expect(getByText('System')).toBeTruthy();
    expect(getByText('Light')).toBeTruthy();
    expect(getByText('Dark')).toBeTruthy();
  });

  it('hides labels when showLabels is false', async () => {
    const { queryByText } = render(
      <ThemeSelectorWithProvider compact showLabels={false} />
    );
    
    // Labels should be hidden in compact mode with showLabels=false
    expect(queryByText('System')).toBeNull();
    expect(queryByText('Light')).toBeNull();
    expect(queryByText('Dark')).toBeNull();
  });

  it('provides correct accessibility labels', async () => {
    const { getByLabelText } = render(<ThemeSelectorWithProvider />);
    
    expect(getByLabelText('System theme: Matches your device settings')).toBeTruthy();
    expect(getByLabelText('Light theme: Light appearance')).toBeTruthy();
    expect(getByLabelText('Dark theme: Dark appearance')).toBeTruthy();
  });
});