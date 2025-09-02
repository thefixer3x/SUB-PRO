import { Tabs } from 'expo-router';
import { LayoutDashboard, CreditCard, BarChart3, Settings, Crown, Store, BarChart2, Users, Shield } from 'lucide-react-native';
import { View, Platform, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSubscription } from '@/hooks/useSubscription';

const { width: screenWidth } = Dimensions.get('window');
const isSmallScreen = screenWidth < 375; // iPhone SE and smaller Android phones

export default function TabLayout() {
  const { currentTier } = useSubscription();
  const insets = useSafeAreaInsets();

  // Calculate dynamic tab bar height with safe area
  const tabBarHeight = Platform.OS === 'ios' ? 70 + insets.bottom : 70;
  const tabBarPaddingBottom = Platform.OS === 'ios' ? insets.bottom + 8 : 8;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#f1f5f9',
          paddingBottom: tabBarPaddingBottom,
          paddingTop: 8,
          height: tabBarHeight,
          paddingHorizontal: isSmallScreen ? 4 : 8, // Less padding on small screens
        },
        tabBarActiveTintColor: '#3B82F6',
        tabBarInactiveTintColor: '#64748B',
        tabBarLabelStyle: {
          fontSize: isSmallScreen ? 10 : 12, // Smaller text on small screens
          fontWeight: '500',
          marginTop: 4,
        },
        tabBarIconStyle: {
          marginBottom: isSmallScreen ? 2 : 4, // Adjust spacing
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ size, color }) => (
            <View>
              <LayoutDashboard size={isSmallScreen ? 20 : size} stroke={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="subscriptions"
        options={{
          title: 'Subscriptions',
          tabBarIcon: ({ size, color }) => (
            <View>
              <CreditCard size={isSmallScreen ? 20 : size} stroke={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: 'Analytics',
          tabBarIcon: ({ size, color }) => (
            <View>
              <BarChart3 size={isSmallScreen ? 20 : size} stroke={color} />
              {currentTier === 'free' && (
                <View style={{
                  position: 'absolute',
                  top: -4,
                  right: -4,
                  backgroundColor: '#F59E0B',
                  borderRadius: 6,
                  width: isSmallScreen ? 10 : 12,
                  height: isSmallScreen ? 10 : 12,
                }} />
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="virtual-cards"
        options={{
          title: 'Cards',
          tabBarIcon: ({ size, color }) => (
            <View>
              <Shield size={isSmallScreen ? 20 : size} stroke={color} />
            </View>
          ),
          // Hide on very small screens to reduce tab crowding
          tabBarButton: isSmallScreen ? () => null : undefined,
        }}
      />
      <Tabs.Screen
        name="community-stats"
        options={{
          title: 'Community',
          tabBarIcon: ({ size, color }) => (
            <View>
              <BarChart2 size={isSmallScreen ? 20 : size} stroke={color} />
            </View>
          ),
          // Hide on very small screens to reduce tab crowding
          tabBarButton: isSmallScreen ? () => null : undefined,
        }}
      />
      <Tabs.Screen
        name="shared-groups"
        options={{
          title: 'Sharing',
          tabBarIcon: ({ size, color }) => (
            <View>
              <Users size={isSmallScreen ? 20 : size} stroke={color} />
            </View>
          ),
          // Hide on very small screens to reduce tab crowding
          tabBarButton: isSmallScreen ? () => null : undefined,
        }}
      />
      <Tabs.Screen
        name="marketplace"
        options={{
          title: 'Marketplace',
          tabBarIcon: ({ size, color }) => (
            <View>
              <Store size={isSmallScreen ? 20 : size} stroke={color} />
            </View>
          ),
          // Hide on very small screens to reduce tab crowding
          tabBarButton: isSmallScreen ? () => null : undefined,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ size, color }) => (
            <View>
              <Settings size={isSmallScreen ? 20 : size} stroke={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="upgrade"
        options={{
          title: currentTier === 'free' ? 'Upgrade' : 'Account',
          tabBarIcon: ({ size, color }) => (
            <View>
              <Crown size={isSmallScreen ? 20 : size} stroke={currentTier === 'free' ? '#F59E0B' : color} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}