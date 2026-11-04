import { renderHook, act } from '@testing-library/react-native';
import { usePreferences } from '@/hooks/usePreferences';

describe('usePreferences', () => {
  it('loads default preferences on mount', async () => {
    const { result } = renderHook(() => usePreferences());

    // Wait for the async load from AsyncStorage to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.preferences.currency).toBe('USD');
    expect(result.current.preferences.theme).toBe('system');
    expect(result.current.preferences.notifications.renewals).toBe(true);
    expect(result.current.isLoading).toBe(false);
  });

  it('persists preferences across a component remount', async () => {
    // Mount 1: read defaults, change a preference
    const { unmount, result } = renderHook(() => usePreferences());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.preferences.currency).toBe('USD');

    // Change currency via setPreferences
    await act(async () => {
      result.current.setPreferences({
        ...result.current.preferences,
        currency: 'EUR',
      });
    });

    // Wait for the useEffect that saves to AsyncStorage to fire
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.preferences.currency).toBe('EUR');

    // Unmount, then mount 2
    unmount();

    const { result: result2 } = renderHook(() => usePreferences());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // The persisted currency should survive the remount
    expect(result2.current.preferences.currency).toBe('EUR');
  });

  it('persists notification toggles across remount', async () => {
    const { unmount, result } = renderHook(() => usePreferences());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.preferences.notifications.weeklyReports).toBe(true);

    // Turn off weekly reports
    await act(async () => {
      result.current.setPreferences({
        ...result.current.preferences,
        notifications: { ...result.current.preferences.notifications, weeklyReports: false },
      });
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    unmount();

    const { result: result2 } = renderHook(() => usePreferences());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result2.current.preferences.notifications.weeklyReports).toBe(false);
  });
});
