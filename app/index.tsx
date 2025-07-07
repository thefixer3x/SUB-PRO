import { useEffect } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';

export default function Index() {
  useEffect(() => {
    // Small delay to ensure router is ready
    const timer = setTimeout(() => {
      try {
        router.replace('/(landing)');
      } catch (error) {
        console.log('Navigation error:', error);
        // Fallback navigation
        router.push('/(landing)');
      }
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  // Return a minimal view while redirecting
  return <View style={{ flex: 1, backgroundColor: '#1E293B' }} />;
}
