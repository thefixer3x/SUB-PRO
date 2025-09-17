import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { SubscriptionProvider } from '@/hooks/useSubscription';
import { queryClient } from '@/hooks/useQueryClient';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { FeatureFlagsProvider } from '@/contexts/FeatureFlagsContext';
import { AuthProvider } from '@/contexts/AuthContext';

export default function RootLayout() {
  useFrameworkReady();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
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
      </AuthProvider>
    </QueryClientProvider>
  );
}
