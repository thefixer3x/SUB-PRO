import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { router, useSegments } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

interface RouteGuardProps {
  children: React.ReactNode;
}

export const RouteGuard: React.FC<RouteGuardProps> = ({ children }) => {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    if (loading) return; // Wait for auth to initialize

    const inAuthGroup = segments[0] === '(auth)';
    const inTabsGroup = segments[0] === '(tabs)';
    const isLanding = segments[0] === '(landing)' || segments.length === 0;

    // User is authenticated
    if (user) {
      // If user is on auth or landing pages, redirect to main app
      if (inAuthGroup || isLanding) {
        setIsNavigating(true);
        router.replace('/(tabs)');
      }
    } else {
      // User is not authenticated
      // If user is trying to access protected routes, redirect to landing
      if (inTabsGroup) {
        setIsNavigating(true);
        router.replace('/(landing)');
      }
    }
  }, [user, loading, segments]);

  // Show loading screen while auth is initializing or navigating
  if (loading || isNavigating) {
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

  return <>{children}</>;
};