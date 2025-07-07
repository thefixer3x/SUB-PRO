import { useState, useEffect, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';

interface BudgetAlertState {
  enabled: boolean;
  budgetLimit: number | null;
  isLoading: boolean;
}

export const useBudgetAlert = () => {
  const [state, setState] = useState<BudgetAlertState>({
    enabled: false,
    budgetLimit: null,
    isLoading: true,
  });

  // Load initial state from SecureStore
  useEffect(() => {
    loadBudgetSettings();
  }, []);

  const loadBudgetSettings = async () => {
    try {
      const [enabledValue, limitValue] = await Promise.all([
        SecureStore.getItemAsync('budgetAlertsEnabled'),
        SecureStore.getItemAsync('budgetLimit'),
      ]);

      setState({
        enabled: enabledValue === 'true',
        budgetLimit: limitValue ? parseFloat(limitValue) : null,
        isLoading: false,
      });
    } catch (error) {
      console.error('Failed to load budget settings:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const setBudgetEnabled = useCallback(async (enabled: boolean) => {
    try {
      await SecureStore.setItemAsync('budgetAlertsEnabled', enabled.toString());
      setState(prev => ({ ...prev, enabled }));
    } catch (error) {
      console.error('Failed to save budget enabled state:', error);
      throw error;
    }
  }, []);

  const setBudgetLimit = useCallback(async (limit: number | null) => {
    try {
      if (limit === null) {
        await SecureStore.deleteItemAsync('budgetLimit');
      } else {
        await SecureStore.setItemAsync('budgetLimit', limit.toString());
      }
      setState(prev => ({ ...prev, budgetLimit: limit }));
    } catch (error) {
      console.error('Failed to save budget limit:', error);
      throw error;
    }
  }, []);

  const checkBudgetAlert = useCallback((currentSpending: number): boolean => {
    if (!state.enabled || !state.budgetLimit) {
      return false;
    }
    return currentSpending >= state.budgetLimit;
  }, [state.enabled, state.budgetLimit]);

  return {
    ...state,
    setBudgetEnabled,
    setBudgetLimit,
    checkBudgetAlert,
    reload: loadBudgetSettings,
  };
};