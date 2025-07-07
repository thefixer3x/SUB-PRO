import { useState, useEffect, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';

type ReminderTiming = '1' | '3' | '7';
type ReportDay = 'monday' | 'friday';

interface ReminderSettings {
  renewalTiming: ReminderTiming;
  reportDay: ReportDay;
}

interface ReminderSettingsState extends ReminderSettings {
  isLoading: boolean;
}

const DEFAULT_SETTINGS: ReminderSettings = {
  renewalTiming: '3',
  reportDay: 'monday',
};

export const useReminderSettings = () => {
  const [state, setState] = useState<ReminderSettingsState>({
    ...DEFAULT_SETTINGS,
    isLoading: true,
  });

  // Load initial settings from SecureStore
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const savedSettings = await SecureStore.getItemAsync('reminderSettings');
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings) as ReminderSettings;
        setState({
          ...parsedSettings,
          isLoading: false,
        });
      } else {
        setState({
          ...DEFAULT_SETTINGS,
          isLoading: false,
        });
      }
    } catch (error) {
      console.error('Failed to load reminder settings:', error);
      setState({
        ...DEFAULT_SETTINGS,
        isLoading: false,
      });
    }
  };

  const updateSettings = useCallback(async (newSettings: Partial<ReminderSettings>) => {
    try {
      const updatedSettings = {
        renewalTiming: newSettings.renewalTiming ?? state.renewalTiming,
        reportDay: newSettings.reportDay ?? state.reportDay,
      };

      await SecureStore.setItemAsync('reminderSettings', JSON.stringify(updatedSettings));
      setState(prev => ({
        ...prev,
        ...updatedSettings,
      }));
    } catch (error) {
      console.error('Failed to save reminder settings:', error);
      throw error;
    }
  }, [state.renewalTiming, state.reportDay]);

  const setRenewalTiming = useCallback(async (timing: ReminderTiming) => {
    await updateSettings({ renewalTiming: timing });
  }, [updateSettings]);

  const setReportDay = useCallback(async (day: ReportDay) => {
    await updateSettings({ reportDay: day });
  }, [updateSettings]);

  // Calculate next notification date based on settings
  const getNextNotificationDate = useCallback((renewalDate: Date): Date => {
    const daysBeforeMap = {
      '1': 1,
      '3': 3,
      '7': 7,
    };
    
    const daysBefore = daysBeforeMap[state.renewalTiming];
    const notificationDate = new Date(renewalDate);
    notificationDate.setDate(notificationDate.getDate() - daysBefore);
    notificationDate.setHours(9, 0, 0, 0); // 9:00 AM notification time
    
    return notificationDate;
  }, [state.renewalTiming]);

  // Calculate next weekly report date
  const getNextReportDate = useCallback((): Date => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const targetDay = state.reportDay === 'monday' ? 1 : 5; // Monday = 1, Friday = 5
    
    let daysUntilTarget = targetDay - dayOfWeek;
    if (daysUntilTarget <= 0) {
      daysUntilTarget += 7; // Next week
    }
    
    const reportDate = new Date(now);
    reportDate.setDate(now.getDate() + daysUntilTarget);
    reportDate.setHours(9, 0, 0, 0); // 9:00 AM report time
    
    return reportDate;
  }, [state.reportDay]);

  return {
    ...state,
    setRenewalTiming,
    setReportDay,
    updateSettings,
    getNextNotificationDate,
    getNextReportDate,
    reload: loadSettings,
  };
};