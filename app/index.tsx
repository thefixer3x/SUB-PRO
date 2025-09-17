import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

export default function Index() {
  const { session, isInitializing } = useAuth();

  useEffect(() => {
    if (isInitializing) {
      return;
    }

    const targetRoute = session ? '/(tabs)' : '/(landing)';

    try {
      router.replace(targetRoute);
    } catch (_error) {
      router.push(targetRoute);
    }
  }, [isInitializing, session]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#1E293B',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <ActivityIndicator size="large" color="#FFFFFF" />
    </View>
  );
}
