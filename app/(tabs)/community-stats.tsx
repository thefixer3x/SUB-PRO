import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { BarChart2, PieChart, TrendingUp, BarChart3 } from 'lucide-react-native';
import { CommunityInsights } from '@/components/social/CommunityInsights';
import { AdBanner } from '@/components/monetization/AdBanner';
import { FeatureGate } from '@/components/monetization/FeatureGate';
import { useSubscription } from '@/hooks/useSubscription';
import { communityStatsService } from '@/services/communityStats';

export default function CommunityStats() {
  const { currentTier } = useSubscription();
  const [userId, setUserId] = useState('user-123'); // In a real app, get from auth context
  const [dataSharing, setDataSharing] = useState(false);

  useEffect(() => {
    loadDataSharingPreferences();
  }, []);

  const loadDataSharingPreferences = async () => {
    try {
      const preferences = await communityStatsService.getUserDataSharing(userId);
      setDataSharing(preferences?.enabled || false);
    } catch (error) {
      console.error('Failed to load data sharing preferences:', error);
    }
  };

  const handleDataSharingToggle = (enabled: boolean) => {
    setDataSharing(enabled);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Community</Text>
          <Text style={styles.subtitle}>
            See how your subscriptions compare to the community
          </Text>
        </View>

        <FeatureGate
          feature="smartInsights"
          requiredTier="free" // This feature is available to all tiers
          fallback={
            <View style={styles.featureDisabled}>
              <BarChart2 size={48} color="#94A3B8" />
              <Text style={styles.featureDisabledTitle}>Coming Soon</Text>
              <Text style={styles.featureDisabledText}>
                Community insights will be available in a future update.
              </Text>
            </View>
          }
        >
          <CommunityInsights 
            userId={userId} 
            onDataSharingToggle={handleDataSharingToggle} 
          />
        </FeatureGate>

        {currentTier === 'free' && <AdBanner placement="community" />}

        {dataSharing && (
          <View style={styles.dataSharingInfo}>
            <Text style={styles.dataSharingTitle}>Thank you for sharing!</Text>
            <Text style={styles.dataSharingText}>
              Your anonymized subscription data helps others make better subscription decisions. 
              Thank you for contributing to the community.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
  },
  featureDisabled: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  featureDisabledTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1E293B',
    marginTop: 16,
    marginBottom: 8,
  },
  featureDisabledText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
  dataSharingInfo: {
    backgroundColor: '#F0FDF4',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  dataSharingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#059669',
    marginBottom: 8,
  },
  dataSharingText: {
    fontSize: 14,
    color: '#047857',
    lineHeight: 20,
  },
});