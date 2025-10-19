import { Redirect, Tabs } from 'expo-router';
import { Home, CreditCard, Users, TrendingUp, User } from 'lucide-react-native';
import { ActivityIndicator, View, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

export default function TabLayout() {
  const { session, isInitializing } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  // Calculate dynamic tab bar height with safe area
  const tabBarHeight = Platform.OS === 'ios' ? 70 + insets.bottom : 70;
  const tabBarPaddingBottom = Platform.OS === 'ios' ? insets.bottom + 8 : 8;

  if (isInitializing) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#F8FAFC',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/signin" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          paddingBottom: tabBarPaddingBottom,
          paddingTop: 8,
          height: tabBarHeight,
          paddingHorizontal: 8,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
          marginTop: 4,
        },
        tabBarIconStyle: {
          marginBottom: 4,
        },
      }}>
      {/* Tab 1: Home/Dashboard */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ size, color }) => <Home size={size} color={color} />,
        }}
      />
      
      {/* Tab 2: Virtual Cards */}
      <Tabs.Screen
        name="virtual-cards"
        options={{
          title: 'Cards',
          tabBarIcon: ({ size, color }) => <CreditCard size={size} color={color} />,
        }}
      />
      
      {/* Tab 3: Groups & Sharing */}
      <Tabs.Screen
        name="shared-groups"
        options={{
          title: 'Groups',
          tabBarIcon: ({ size, color }) => <Users size={size} color={color} />,
        }}
      />
      
      {/* Tab 4: Analytics & Activity */}
      <Tabs.Screen
        name="analytics"
        options={{
          title: 'Activity',
          tabBarIcon: ({ size, color }) => <TrendingUp size={size} color={color} />,
        }}
      />
      
      {/* Tab 5: Account & Settings */}
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Account',
          tabBarIcon: ({ size, color }) => <User size={size} color={color} />,
        }}
      />
      
      {/* Hidden tabs - still accessible via navigation but not in tab bar */}
      <Tabs.Screen name="subscriptions" options={{ href: null }} />
      <Tabs.Screen name="community-stats" options={{ href: null }} />
      <Tabs.Screen name="marketplace" options={{ href: null }} />
      <Tabs.Screen name="upgrade" options={{ href: null }} />
      <Tabs.Screen name="reminder-settings" options={{ href: null }} />
    </Tabs>
  );
}