jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// expo-crypto's native module needs an ExpoModule proxy in the jest
// environment. Mock it with the platform CSPRNG so tests exercise the same
// API the app calls, and so no insecure fallback is possible.
jest.mock('expo-crypto', () => {
  const nodeCrypto = require('crypto');

  return {
    getRandomBytes: (byteCount: number) => {
      const bytes = new Uint8Array(byteCount);
      nodeCrypto.randomFillSync(bytes);
      return bytes;
    },
    getRandomBytesAsync: async (byteCount: number) => {
      const bytes = new Uint8Array(byteCount);
      nodeCrypto.randomFillSync(bytes);
      return bytes;
    },
    getRandomValues: <T extends Uint8Array>(typedArray: T): T => {
      nodeCrypto.randomFillSync(typedArray);
      return typedArray;
    },
    randomUUID: () => nodeCrypto.randomUUID(),
  };
});

// Global mock for @/lib/supabase — used by useSubscription hook tests.
// Each test file can override with its own jest.mock for different profile rows.
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => ({ data: null, error: null }),
        }),
      }),
    }),
  },
  isSupabaseEnvConfigured: true,
  createClient: jest.fn(() => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => ({ data: null, error: null }),
        }),
      }),
    }),
  })),
}));

// Global mock for AuthContext — used by useSubscription hook tests.
jest.mock('@/contexts/AuthContext', () => {
  const AuthContext = {
    Provider: ({ children, value }: { children: React.ReactNode; value: Record<string, unknown> }) =>
      children as React.ReactElement | null,
  };
  return {
    AuthContext,
    useAuth: () => ({
      user: { id: 'test-user', email: 'test@test.com' },
      session: null,
    }),
    AuthProvider: ({ children }: { children: React.ReactNode }) =>
      children as React.ReactElement | null,
  };
});

// Global mock for expo-router — used by billing/success component tests.
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({}),
  router: { replace: jest.fn(), push: jest.fn() },
  Link: jest.fn().mockReturnValue(null),
}));

// Global mock for ThemeContext — used by billing/success component tests.
jest.mock('@/contexts/ThemeContext', () => {
  const setThemeModeMock = jest.fn(async (mode: string) => {
    await require('@react-native-async-storage/async-storage').setItem('app_theme_mode', mode);
  });
  const toggleThemeMock = jest.fn();
  return {
    ThemeProvider: ({ children }: { children: React.ReactNode }) =>
      children as React.ReactElement | null,
    useTheme: () => ({
      themeMode: 'system' as const,
      themeName: 'light' as const,
      colors: { background: '#fff', text: '#000', textSecondary: '#666', textMuted: '#999', primary: '#3b82f6' },
      setThemeMode: setThemeModeMock,
      toggleTheme: toggleThemeMock,
      isLoading: false,
    }),
    useThemeColors: () => ({
      background: '#fff', text: '#000', textSecondary: '#666', textMuted: '#999', primary: '#3b82f6',
    }),
    createThemedStyles: <T extends Record<string, any>>(styleFactory: (colors: any) => T) =>
      (_colors: any) => styleFactory(_colors),
    _setThemeModeMock: setThemeModeMock,
    _toggleThemeMock: toggleThemeMock,
  };
});

// Global mock for safe-area-context
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) =>
    children as React.ReactElement | null,
  useSafeAreaInsets: jest.fn(() => ({ top: 0, bottom: 0, left: 0, right: 0 })),
}));
