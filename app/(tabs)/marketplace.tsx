import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, Dimensions, ActivityIndicator, Linking, Platform } from 'react-native';
import { PARTNERS } from '@/data/partners';
import { Partner } from '@/types/partner';
import { PartnerCard } from '@/components/marketplace/PartnerCard';
import { PartnerModal } from '@/components/marketplace/PartnerModal';
import { partnerTrackingService } from '@/services/partnerTracking';
import { Gift } from 'lucide-react-native';

const { width } = Dimensions.get('window');
const isTablet = width >= 768;

// Feature flag check - in a real app, this would come from your feature flag system
const FEATURE_FLAG_PARTNER_HUB = true;

export default function Marketplace() {
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Mock user ID - in a real app, you would get this from authentication context
  const userId = "user123";

  useEffect(() => {
    // Simulate loading partners
    const loadingTimer = setTimeout(() => {
      setLoading(false);
    }, 800);

    return () => clearTimeout(loadingTimer);
  }, []);

  const handlePartnerPress = (partner: Partner) => {
    setSelectedPartner(partner);
    setModalVisible(true);
    
    // Track this click
    partnerTrackingService.trackClick(partner.id, userId, 'card');
  };

  const handleClaimDeal = (partner: Partner) => {
    const referenceUrl = partnerTrackingService.generateReferenceUrl(partner.deeplink, userId);
    
    // Open the URL
    if (Platform.OS === 'web') {
      window.open(referenceUrl, '_blank');
    } else {
      Linking.openURL(referenceUrl);
    }
    
    // Close the modal
    setModalVisible(false);
  };

  // Check if feature flag is enabled
  if (!FEATURE_FLAG_PARTNER_HUB) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.featureDisabled}>
          <Gift size={48} color="#94A3B8" />
          <Text style={styles.featureDisabledTitle}>Coming Soon</Text>
          <Text style={styles.featureDisabledText}>
            The Partner Marketplace will be available in a future update.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Marketplace</Text>
          <Text style={styles.subtitle}>Exclusive deals for our users</Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={styles.loadingText}>Loading deals...</Text>
          </View>
        ) : (
          <>
            <View style={styles.highlightSection}>
              <Text style={styles.sectionTitle}>Featured Partners</Text>
              <Text style={styles.sectionSubtitle}>
                Special discounts from our technology partners
              </Text>
            </View>
            
            <View style={[
              styles.partnersGrid,
              isTablet && styles.partnersGridTablet
            ]}>
              {PARTNERS.map((partner) => (
                <PartnerCard 
                  key={partner.id} 
                  partner={partner}
                  onPress={() => handlePartnerPress(partner)}
                />
              ))}
            </View>

            <View style={styles.infoSection}>
              <Text style={styles.infoTitle}>How It Works</Text>
              <View style={styles.infoCard}>
                <Text style={styles.infoText}>
                  <Text style={styles.infoBold}>Exclusive Deals: </Text>
                  We've partnered with top technology providers to bring you discounts and special offers.
                </Text>
                <Text style={styles.infoText}>
                  <Text style={styles.infoBold}>Seamless Experience: </Text>
                  Click "Claim Deal\" and we'll take you directly to the partner\'s site with your discount applied.
                </Text>
                <Text style={styles.infoText}>
                  <Text style={styles.infoBold}>No Extra Costs: </Text>
                  All deals are free for Subscription Manager users. We may receive a commission if you subscribe through our links.
                </Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      <PartnerModal
        partner={selectedPartner}
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onClaimDeal={handleClaimDeal}
        userId={userId}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
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
  loadingContainer: {
    flex: 1,
    padding: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748B',
  },
  highlightSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#64748B',
  },
  partnersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  partnersGridTablet: {
    justifyContent: 'flex-start',
    gap: 16,
  },
  infoSection: {
    paddingHorizontal: 20,
    marginBottom: 40,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 12,
  },
  infoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  infoText: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
    marginBottom: 12,
  },
  infoBold: {
    fontWeight: '600',
    color: '#1E293B',
  },
  featureDisabled: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  featureDisabledTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 16,
    marginBottom: 8,
  },
  featureDisabledText: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 24,
  },
});