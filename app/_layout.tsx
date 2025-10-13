import { type PropsWithChildren, useEffect } from 'react';
import { Stack, useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { SubscriptionProvider } from '@/hooks/useSubscription';
import { queryClient } from '@/hooks/useQueryClient';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { FeatureFlagsProvider } from '@/contexts/FeatureFlagsContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';

const AuthNavigationGuard = ({ children }: PropsWithChildren) => {
  const { session, isInitializing } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const navigationState = useRootNavigationState();

  useEffect(() => {
    if (!navigationState?.key || isInitializing) {
      return;
    }

    const [maybeGroup] = segments;
    const inAuthGroup = maybeGroup === '(auth)';
    const inLandingGroup = maybeGroup === '(landing)' || maybeGroup === undefined;

    if (!session) {
      if (!inAuthGroup && !inLandingGroup) {
        router.replace('/(auth)/signin');
      }
      return;
    }

    if (inAuthGroup || inLandingGroup) {
      router.replace('/(tabs)');
    }
  }, [isInitializing, navigationState?.key, router, segments, session]);

  return <>{children}</>;
};

export default function RootLayout() {
  useFrameworkReady();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthNavigationGuard>
          <ThemeProvider>
            <FeatureFlagsProvider>
              <SubscriptionProvider>
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="(landing)" />
                  <Stack.Screen name="(auth)" />
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="+not-found" />
                </Stack>
                <StatusBar style="auto" />
              </SubscriptionProvider>
            </FeatureFlagsProvider>
          </ThemeProvider>
        </AuthNavigationGuard>
      </AuthProvider>
    </QueryClientProvider>
  );
}
