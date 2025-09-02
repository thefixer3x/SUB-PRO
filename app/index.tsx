import { useEffect } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

export default function Index() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return; // Wait for auth to initialize

    // Small delay to ensure router is ready
    const timer = setTimeout(() => {
      try {
        if (user) {
          router.replace('/(tabs)');
        } else {
          router.replace('/(landing)');
        }
      } catch (error) {
        console.log('Navigation error:', error);
        // Fallback navigation
        router.push('/(landing)');
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [user, loading]);

  // Show loading while determining route
  return (
    <View style={{ 
      flex: 1, 
      backgroundColor: '#1E293B', 
      justifyContent: 'center', 
      alignItems: 'center' 
    }}>
      <ActivityIndicator size="large" color="#ffffff" />
      <Text style={{ 
        color: '#ffffff', 
        marginTop: 16, 
        fontSize: 16 
      }}>
        Loading...
      </Text>
    </View>
  );
}
