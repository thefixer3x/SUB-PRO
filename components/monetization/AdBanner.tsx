import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useSubscription } from '@/hooks/useSubscription';
import { adConfig, shouldShowAds, canShowBanner } from '@/config/monetization';

interface AdBannerProps {
  placement: 'home' | 'subscriptions' | 'analytics' | 'community';
  size?: 'banner' | 'large-banner' | 'medium-rectangle';
}

export const AdBanner: React.FC<AdBannerProps> = ({ 
  placement, 
  size = 'banner' 
}) => {
  const { currentTier } = useSubscription();
  const [adLoaded, setAdLoaded] = useState(false);
  const [adError, setAdError] = useState(false);
  const [lastShown, setLastShown] = useState<Date | null>(null);

  useEffect(() => {
    loadAd();
  }, []);

  // Don't show ads if user shouldn't see them or frequency limits
  if (!shouldShowAds(currentTier) || !canShowBanner(lastShown)) return null;

  const loadAd = async () => {
    try {
      // For web platform, we'll show placeholder ads
      // In production, integrate with Google AdSense
      if (Platform.OS === 'web') {
        // Use AdSense configuration
        console.log('Loading AdSense ad with publisher ID:', adConfig.adSenseIds.publisher);
        // Simulate ad loading
        setTimeout(() => {
          setAdLoaded(true);
          setLastShown(new Date());
        }, 1000);
        return;
      }

      // For mobile platforms, integrate with AdMob
      console.log('Loading AdMob banner ad:', adConfig.adMobIds.banner);
      console.log('Ad placement:', placement);
      
      // TODO: Implement actual AdMob SDK integration
      // const adUnit = adConfig.adMobIds.banner;
      // await loadAdMobBanner(adUnit);
      
      setAdLoaded(true);
      setLastShown(new Date());
    } catch (error) {
      console.error('Failed to load ad:', error);
      setAdError(true);
    }
  };

  const getAdDimensions = () => {
    switch (size) {
      case 'banner':
        return { width: 320, height: 50 };
      case 'large-banner':
        return { width: 320, height: 100 };
      case 'medium-rectangle':
        return { width: 300, height: 250 };
      default:
        return { width: 320, height: 50 };
    }
  };

  const dimensions = getAdDimensions();

  if (adError) return null;

  return (
    <View style={[styles.container, { width: dimensions.width, height: dimensions.height }]}>
      {adLoaded ? (
        <View style={[styles.adContent, { width: dimensions.width, height: dimensions.height }]}>
          <Text style={styles.adLabel}>Advertisement</Text>
          <View style={styles.mockAd}>
            <Text style={styles.mockAdText}>
              {Platform.OS === 'web' ? 'Google AdSense Ad' : 'AdMob Ad'}
            </Text>
            <Text style={styles.mockAdSubtext}>
              {placement} placement • {size}
            </Text>
          </View>
        </View>
      ) : (
        <View style={[styles.loading, { width: dimensions.width, height: dimensions.height }]}>
          <Text style={styles.loadingText}>Loading ad...</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    marginVertical: 16,
    borderRadius: 8,
    overflow: 'hidden',
  },
  adContent: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
  },
  adLabel: {
    fontSize: 10,
    color: '#94A3B8',
    textAlign: 'center',
    paddingVertical: 2,
    backgroundColor: '#F1F5F9',
  },
  mockAd: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  mockAdText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  mockAdSubtext: {
    fontSize: 12,
    color: '#64748B',
  },
  loading: {
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  loadingText: {
    fontSize: 12,
    color: '#94A3B8',
  },
});