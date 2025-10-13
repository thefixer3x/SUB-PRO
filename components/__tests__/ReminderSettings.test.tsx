import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import ReminderSettings from '../../app/(tabs)/reminder-settings';
import * as SecureStore from 'expo-secure-store';

// Mock router
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: mockBack,
  }),
}));

// Mock SecureStore
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(() => Promise.resolve()),
  getItemAsync: jest.fn(() => Promise.resolve(null)),
}));

// Mock Haptics
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: {
    Success: 'success',
  },
}));

describe('ReminderSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly with default settings', async () => {
    const { getByText } = render(<ReminderSettings />);
    
    await waitFor(() => {
      expect(getByText('Reminder Settings')).toBeTruthy();
      expect(getByText('Renewal Notifications')).toBeTruthy();
      expect(getByText('Weekly Reports')).toBeTruthy();
    });
  });

  it('loads saved settings from SecureStore', async () => {
    const savedSettings = {
      renewalTiming: '7',
      reportDay: 'friday',
    };
    
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(
      JSON.stringify(savedSettings)
    );
    
    const { getByText } = render(<ReminderSettings />);
    
    await waitFor(() => {
      expect(getByText('7 days before')).toBeTruthy();
      expect(getByText('Friday')).toBeTruthy();
    });
  });

  it('updates renewal timing setting', async () => {
    const { getByText } = render(<ReminderSettings />);
    
    await waitFor(() => {
      const oneDayOption = getByText('1 day before');
      fireEvent.press(oneDayOption);
    });
    
    await waitFor(() => {
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'reminderSettings',
        JSON.stringify({
          renewalTiming: '1',
          reportDay: 'monday',
        })
      );
    });
  });

  it('updates report day setting', async () => {
    const { getByText } = render(<ReminderSettings />);
    
    await waitFor(() => {
      const fridayOption = getByText('Friday');
      fireEvent.press(fridayOption);
    });
    
    await waitFor(() => {
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'reminderSettings',
        JSON.stringify({
          renewalTiming: '3',
          reportDay: 'friday',
        })
      );
    });
  });

  it('navigates back when back button is pressed', async () => {
    const { getByTestId } = render(<ReminderSettings />);

    const backButton = await waitFor(() => getByTestId('back-button'));
    fireEvent.press(backButton);

    expect(mockBack).toHaveBeenCalled();
  });

  it('shows loading state initially', () => {
    const { getByText } = render(<ReminderSettings />);
    expect(getByText('Loading settings...')).toBeTruthy();
  });

  it('displays correct descriptions for selected options', async () => {
    const { getByText } = render(<ReminderSettings />);
    
    await waitFor(() => {
      expect(getByText('Get notified 3 days before renewal')).toBeTruthy();
      expect(getByText('Start your week with spending insights')).toBeTruthy();
    });
  });
});