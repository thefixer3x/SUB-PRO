import React from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { TrendingUp, TrendingDown, DollarSign, CreditCard, PieChart, BarChart3 } from 'lucide-react-native';

const { width } = Dimensions.get('window');

interface FinancialMetric {
  id: string;
  title: string;
  value: string;
  change: string;
  changeType: 'positive' | 'negative';
  icon: React.ComponentType<any>;
  color: [string, string, ...string[]];
}

interface FinancialDashboardProps {
  totalSpent?: number;
  monthlyRecurring?: number;
  activeSubscriptions?: number;
  potentialSavings?: number;
}

export const FinancialDashboard: React.FC<FinancialDashboardProps> = ({
  totalSpent = 2847.50,
  monthlyRecurring = 234.99,
  activeSubscriptions = 12,
  potentialSavings = 89.99
}) => {
  // Change values are left blank until real historical comparison
  // data is available.  Fabricating trends is misleading (PR review).
  const metrics: FinancialMetric[] = [
    {
      id: 'total-spent',
      title: 'Total Spent',
      value: `$${totalSpent.toLocaleString()}`,
      change: '',
      changeType: 'positive',
      icon: DollarSign,
      color: ['#667eea', '#764ba2']
    },
    {
      id: 'monthly-recurring',
      title: 'Monthly Recurring',
      value: `$${monthlyRecurring.toFixed(2)}`,
      change: '',
      changeType: 'positive',
      icon: CreditCard,
      color: ['#f093fb', '#f5576c']
    },
    {
      id: 'active-subs',
      title: 'Active Subscriptions',
      value: activeSubscriptions.toString(),
      change: '',
      changeType: 'positive',
      icon: PieChart,
      color: ['#4facfe', '#00f2fe']
    },
    {
      id: 'potential-savings',
      title: 'Potential Savings',
      value: `$${potentialSavings.toFixed(2)}`,
      change: '',
      changeType: 'positive',
      icon: TrendingUp,
      color: ['#43e97b', '#38f9d7']
    }
  ];

  const renderMetricCard = (metric: FinancialMetric) => {
    const IconComponent = metric.icon;
    const TrendIcon = metric.changeType === 'positive' ? TrendingUp : TrendingDown;
    
    return (
      <View key={metric.id} style={styles.metricCard}>
        <LinearGradient
          colors={metric.color}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientCard}
        >
          <View style={styles.cardHeader}>
            <View style={styles.iconContainer}>
              <IconComponent size={24} color="white" />
            </View>
            {metric.change ? (
              <View style={styles.changeContainer}>
                <TrendIcon
                  size={16}
                  color={metric.changeType === 'positive' ? '#10B981' : '#EF4444'}
                />
                <Text style={[
                  styles.changeText,
                  { color: metric.changeType === 'positive' ? '#10B981' : '#EF4444' }
                ]}>
                  {metric.change}
                </Text>
              </View>
            ) : null}
          </View>
          
          <View style={styles.cardContent}>
            <Text style={styles.metricValue}>{metric.value}</Text>
            <Text style={styles.metricTitle}>{metric.title}</Text>
          </View>
        </LinearGradient>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Financial Overview</Text>
        <Text style={styles.headerSubtitle}>Your subscription spending insights</Text>
      </View>

      <View style={styles.metricsGrid}>
        {metrics.map(renderMetricCard)}
      </View>

      <View style={styles.insightsSection}>
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.insightsCard}
        >
          <View style={styles.insightsHeader}>
            <BarChart3 size={24} color="white" />
            <Text style={styles.insightsTitle}>AI Insights</Text>
          </View>
          <Text style={styles.insightsText}>
            You could save ${potentialSavings.toFixed(2)}/month by optimizing your subscriptions. 
            Consider canceling unused services or switching to annual plans.
          </Text>
        </LinearGradient>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    padding: 20,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: '400',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    justifyContent: 'space-between',
  },
  metricCard: {
    width: (width - 60) / 2,
    marginBottom: 16,
  },
  gradientCard: {
    borderRadius: 16,
    padding: 20,
    minHeight: 140,
    justifyContent: 'space-between',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  iconContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    padding: 8,
  },
  changeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  changeText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  cardContent: {
    marginTop: 12,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '700',
    color: 'white',
    marginBottom: 4,
  },
  metricTitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  insightsSection: {
    padding: 20,
    paddingTop: 10,
  },
  insightsCard: {
    borderRadius: 16,
    padding: 20,
  },
  insightsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  insightsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
    marginLeft: 8,
  },
  insightsText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 20,
  },
});
