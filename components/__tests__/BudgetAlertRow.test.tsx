import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { BudgetAlertRow } from '../BudgetAlertRow';
import * as SecureStore from 'expo-secure-store';

// Mock SecureStore
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(() => Promise.resolve()),
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

// Mock Haptics
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: {
    Success: 'success',
  },
}));

describe('BudgetAlertRow', () => {
  const defaultProps = {
    enabled: false,
    onToggle: jest.fn(),
    budgetLimit: null,
    onBudgetChange: jest.fn(),
    currency: 'USD',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly with default props', () => {
    const { getByText } = render(<BudgetAlertRow {...defaultProps} />);
    
    expect(getByText('Budget Alerts')).toBeTruthy();
    expect(getByText('Warn when spending exceeds budget')).toBeTruthy();
  });

  it('shows budget limit when enabled and limit is set', () => {
    const { getByText } = render(
      <BudgetAlertRow 
        {...defaultProps} 
        enabled={true} 
        budgetLimit={100} 
      />
    );
    
    expect(getByText('Warn when spending exceeds $100.00')).toBeTruthy();
    expect(getByText('Tap to edit budget limit')).toBeTruthy();
  });

  it('opens modal when toggling on without budget limit', async () => {
    const { getByTestId, getByText } = render(
      <BudgetAlertRow {...defaultProps} />
    );
    
    const toggle = getByTestId('budget-alert-switch');
    fireEvent(toggle, 'onValueChange', true);
    
    await waitFor(() => {
      expect(getByText('Set Budget Limit')).toBeTruthy();
    });
  });

  it('validates input correctly', async () => {
    const { getByTestId, getByText, getByPlaceholderText } = render(
      <BudgetAlertRow {...defaultProps} />
    );

    // Open modal
    const toggle = getByTestId('budget-alert-switch');
    fireEvent(toggle, 'onValueChange', true);

    const input = await waitFor(() => getByPlaceholderText('0.00'));

    // Try to save without input
    const saveButton = getByText('Save');
    fireEvent.press(saveButton);

    await waitFor(() => {
      expect(getByText('Budget limit is required when alerts are enabled')).toBeTruthy();
    });

    // Enter invalid input
    fireEvent.changeText(input, '-5');
    fireEvent.press(saveButton);

    await waitFor(() => {
      expect(getByText('Please enter a valid positive number')).toBeTruthy();
    });
  });

  it('saves budget limit successfully', async () => {
    const onToggle = jest.fn();
    const onBudgetChange = jest.fn();
    
    const { getByTestId, getByText, getByPlaceholderText } = render(
      <BudgetAlertRow
        {...defaultProps}
        onToggle={onToggle}
        onBudgetChange={onBudgetChange}
      />
    );

    // Open modal
    const toggle = getByTestId('budget-alert-switch');
    fireEvent(toggle, 'onValueChange', true);

    // Enter valid input
    const input = await waitFor(() => getByPlaceholderText('0.00'));
    fireEvent.changeText(input, '150.50');
    
    // Save
    const saveButton = getByText('Save');
    fireEvent.press(saveButton);
    
    await waitFor(() => {
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('budgetLimit', '150.5');
      expect(onBudgetChange).toHaveBeenCalledWith(150.5);
      expect(onToggle).toHaveBeenCalledWith(true);
    });
  });

  it('filters input to numbers and decimal only', async () => {
    const { getByTestId, getByPlaceholderText } = render(
      <BudgetAlertRow {...defaultProps} />
    );

    // Open modal
    const toggle = getByTestId('budget-alert-switch');
    fireEvent(toggle, 'onValueChange', true);

    const input = await waitFor(() => getByPlaceholderText('0.00'));
    
    // Test filtering
    fireEvent.changeText(input, 'abc123.45def');
    
    // Should only keep numbers and decimal point
    expect(input.props.value).toBe('123.45');
  });
});