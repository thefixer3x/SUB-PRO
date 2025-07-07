import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { BarChart2, Users, TrendingUp, Shield } from 'lucide-react-native';
import { communityStatsService } from '@/services/communityStats';
import { useSubscription } from '@/hooks/useSubscription';

interface CommunityInsightsProps {
  userId: string;
  onDataSharingToggle?: (enabled: boolean) => void;
}

export const CommunityInsights: React.FC<CommunityInsightsProps> = ({
  userId,
  onDataSharingToggle,
}) => {
  const { currentTier } = useSubscription();
  const [dataSharingEnabled, setDataSharingEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [mostTrackedServices, setMostTrackedServices] = useState<Array<{
    serviceName: string;
    userCount: number;
    averageCost: number;
    category: string;
  }>>([]);
  const [categoryInsights, setCategoryInsights] = useState<Array<{
    category: string;
    averageCost: number;
    userCount: number;
    totalSpending: number;
  }>>([]);

  useEffect(() => {
    loadDataSharingPreferences();
    loadCommunityData();
  }, [userId]);

  const loadDataSharingPreferences = async () => {
    try {
      const preferences = await communityStatsService.getUserDataSharing(userId);
      setDataSharingEnabled(preferences?.enabled || false);
    } catch (error) {
      console.error('Failed to load data sharing preferences:', error);
    }
  };

  const loadCommunityData = async () => {
    try {
      setIsLoading(true);
      
      // Load most tracked services
      const services = await communityStatsService.getMostTrackedServices(10);
      setMostTrackedServices(services);
      
      // Load category insights
      const categories = await communityStatsService.getCategoryInsights();
      setCategoryInsights(categories);
    } catch (error) {
      console.error('Failed to load community data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDataSharingToggle = async (value: boolean) => {
    try {
      setDataSharingEnabled(value);
      
      await communityStatsService.updateUserDataSharing(userId, {
        enabled: value,
        dataTypes: {
          subscriptionCosts: value,
          categories: value,
          planTypes: value,
        },
        consentDate: new Date(),
      });
      
      if (onDataSharingToggle) {
        onDataSharingToggle(value);
      }
      
      // Reload data if sharing is enabled
      if (value) {
        loadCommunityData();
      }
    } catch (error) {
      console.error('Failed to update data sharing preferences:', error);
      // Revert UI state if update fails
      setDataSharingEnabled(!value);
    }
  };

  const getMaxUserCount = () => {
    return Math.max(...mostTrackedServices.map(service => service.userCount), 1);
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading community insights...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Users size={20} color="#3B82F6" />
          <Text style={styles.headerTitle}>Community Insights</Text>
        </View>
        <View style={styles.switchContainer}>
          <Text style={styles.switchLabel}>Share anonymized data</Text>
          <Switch
            value={dataSharingEnabled}
            onValueChange={handleDataSharingToggle}
            trackColor={{ false: '#E5E7EB', true: '#3B82F6' }}
            thumbColor="#ffffff"
          />
        </View>
      </View>
      
      <View style={styles.infoCard}>
        <Shield size={18} color="#64748B" />
        <Text style={styles.infoText}>
          All data is anonymized and aggregated. No personal information is shared.
          Opting in helps the community make better subscription decisions.
        </Text>
      </View>
      
      {!dataSharingEnabled ? (
        <View style={styles.optInPrompt}>
          <Text style={styles.optInTitle}>Enable Data Sharing</Text>
          <Text style={styles.optInDescription}>
            Share anonymous data about your subscriptions to see how your spending compares
            with the community. Turn on the switch above to participate.
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {mostTrackedServices.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Most-Tracked Services
              </Text>
              <View style={styles.servicesContainer}>
                {mostTrackedServices.map((service, index) => (
                  <View key={index} style={styles.serviceItem}>
                    <View style={styles.serviceDetails}>
                      <Text style={styles.serviceName}>{service.serviceName}</Text>
                      <Text style={styles.serviceCategory}>{service.category}</Text>
                    </View>
                    <View style={styles.serviceStats}>
                      <Text style={styles.statValue}>{service.userCount} users</Text>
                      <Text style={styles.statValue}>${service.averageCost.toFixed(2)}/mo</Text>
                    </View>
                    <View style={styles.barContainer}>
                      <View 
                        style={[
                          styles.bar, 
                          { width: `${(service.userCount / getMaxUserCount()) * 100}%` }
                        ]} 
                      />
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <BarChart2 size={40} color="#94A3B8" />
              <Text style={styles.emptyTitle}>No Community Data Yet</Text>
              <Text style={styles.emptyDescription}>
                Be among the first to share anonymous subscription data
                and help build the community insights.
              </Text>
            </View>
          )}
          
          {categoryInsights.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Spending by Category
              </Text>
              <View style={styles.categoryContainer}>
                {categoryInsights.map((category, index) => (
                  <View key={index} style={styles.categoryItem}>
                    <View style={styles.categoryHeader}>
                      <Text style={styles.categoryName}>{category.category}</Text>
                      <Text style={styles.categoryAvg}>
                        Avg: ${category.averageCost.toFixed(2)}/mo
                      </Text>
                    </View>
                    <View style={styles.categoryUsers}>
                      <Users size={14} color="#64748B" />
                      <Text style={styles.usersCount}>{category.userCount} users</Text>
                    </View>
                    <View style={styles.categoryMeter}>
                      <TrendingUp size={14} color="#3B82F6" />
                      <Text style={styles.meterLabel}>Total community spending:</Text>
                      <Text style={styles.meterValue}>${category.totalSpending.toFixed(2)}/mo</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}
          
          <View style={styles.disclaimer}>
            <Text style={styles.disclaimerText}>
              Community insights are calculated based on anonymized data from users who have opted in.
              Your personal data is never shared individually.
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    marginLeft: 8,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchLabel: {
    fontSize: 14,
    color: '#64748B',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8FAFC',
    padding: 12,
    margin: 16,
    borderRadius: 8,
    gap: 8,
  },
  infoText: {
    fontSize: 12,
    color: '#64748B',
    flex: 1,
    lineHeight: 16,
  },
  optInPrompt: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  optInTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
  },
  optInDescription: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 24,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#64748B',
  },
  section: {
    marginVertical: 16,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 16,
  },
  servicesContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
  },
  serviceItem: {
    marginBottom: 16,
  },
  serviceDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  serviceName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1E293B',
  },
  serviceCategory: {
    fontSize: 12,
    color: '#64748B',
  },
  serviceStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  statValue: {
    fontSize: 12,
    color: '#64748B',
  },
  barContainer: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: 3,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
  categoryContainer: {
    gap: 12,
  },
  categoryItem: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1E293B',
  },
  categoryAvg: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
  },
  categoryUsers: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  usersCount: {
    fontSize: 12,
    color: '#64748B',
  },
  categoryMeter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  meterLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  meterValue: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1E293B',
  },
  disclaimer: {
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    margin: 16,
  },
  disclaimerText: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
    textAlign: 'center',
  },
});