import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal } from 'react-native';
import { 
  Brain, 
  TrendingDown, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  DollarSign,
  Zap,
  X,
  ChevronRight,
  Calendar,
  PauseCircle,
  XCircle,
  RefreshCw
} from 'lucide-react-native';
import { aiAssistantService } from '@/services/aiAssistant';
import { AIRecommendation, SubscriptionInsight } from '@/types/aiAssistant';

interface AIAssistantProps {
  subscriptions: any[];
  userId: string;
  visible: boolean;
  onClose: () => void;
}

export const AIAssistant: React.FC<AIAssistantProps> = ({
  subscriptions,
  userId,
  visible,
  onClose,
}) => {
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>([]);
  const [insights, setInsights] = useState<SubscriptionInsight[]>([]);
  const [monthlyOptimization, setMonthlyOptimization] = useState(0);
  const [yearlyOptimization, setYearlyOptimization] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'recommendations' | 'insights' | 'notifications'>('recommendations');

  useEffect(() => {
    if (visible) {
      analyzeSubscriptions();
    }
  }, [visible, subscriptions]);

  const analyzeSubscriptions = async () => {
    try {
      setLoading(true);
      
      // Generate mock usage data for demo
      const usageData = aiAssistantService.generateMockUsageData(subscriptions);
      
      // Analyze subscriptions
      const analysis = await aiAssistantService.analyzeSubscriptions(
        subscriptions,
        usageData,
        userId
      );
      
      setRecommendations(analysis.recommendations);
      setInsights(analysis.insights);
      setMonthlyOptimization(analysis.monthlyOptimization);
      setYearlyOptimization(analysis.yearlyOptimization);
    } catch (error) {
      console.error('Failed to analyze subscriptions:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRecommendationIcon = (type: AIRecommendation['type']) => {
    switch (type) {
      case 'cancel':
        return <XCircle size={20} color="#EF4444" />;
      case 'pause':
        return <PauseCircle size={20} color="#F59E0B" />;
      case 'optimize':
        return <TrendingUp size={20} color="#3B82F6" />;
      case 'switch_plan':
        return <RefreshCw size={20} color="#10B981" />;
      case 'bundle_opportunity':
        return <Zap size={20} color="#8B5CF6" />;
      default:
        return <CheckCircle size={20} color="#10B981" />;
    }
  };

  const getInsightIcon = (type: SubscriptionInsight['type']) => {
    switch (type) {
      case 'overspending':
        return <TrendingDown size={16} color="#EF4444" />;
      case 'underutilized':
        return <AlertTriangle size={16} color="#F59E0B" />;
      case 'good_value':
        return <CheckCircle size={16} color="#10B981" />;
      default:
        return <Clock size={16} color="#64748B" />;
    }
  };

  const getSeverityColor = (severity: SubscriptionInsight['severity']) => {
    switch (severity) {
      case 'critical': return '#EF4444';
      case 'alert': return '#F59E0B';
      case 'warning': return '#F59E0B';
      default: return '#3B82F6';
    }
  };

  const renderRecommendation = (recommendation: AIRecommendation) => (
    <View key={recommendation.id} style={styles.recommendationCard}>
      <View style={styles.recommendationHeader}>
        <View style={styles.recommendationIcon}>
          {getRecommendationIcon(recommendation.type)}
        </View>
        <View style={styles.recommendationInfo}>
          <Text style={styles.recommendationTitle}>{recommendation.title}</Text>
          <Text style={styles.recommendationDescription}>{recommendation.description}</Text>
        </View>
        <View style={styles.recommendationSavings}>
          <Text style={styles.savingsAmount}>${recommendation.potentialSavings.toFixed(2)}</Text>
          <Text style={styles.savingsLabel}>potential savings</Text>
        </View>
      </View>
      
      <View style={styles.recommendationDetails}>
        <View style={styles.confidenceContainer}>
          <Text style={styles.confidenceLabel}>Confidence: {recommendation.confidence}%</Text>
          <View style={styles.confidenceBar}>
            <View 
              style={[
                styles.confidenceFill, 
                { width: `${recommendation.confidence}%` }
              ]} 
            />
          </View>
        </View>
        
        <Text style={styles.actionRequired}>{recommendation.actionRequired}</Text>
        
        {recommendation.reasoning.length > 0 && (
          <View style={styles.reasoningContainer}>
            <Text style={styles.reasoningTitle}>Why we recommend this:</Text>
            {recommendation.reasoning.map((reason, index) => (
              <Text key={index} style={styles.reasoningItem}>• {reason}</Text>
            ))}
          </View>
        )}
        
        {recommendation.deadline && (
          <View style={styles.deadlineContainer}>
            <Calendar size={14} color="#F59E0B" />
            <Text style={styles.deadlineText}>
              Recommended by: {recommendation.deadline.toLocaleDateString()}
            </Text>
          </View>
        )}
      </View>
    </View>
  );

  const renderInsight = (insight: SubscriptionInsight) => (
    <View key={`${insight.type}_${insight.subscriptionIds.join('_')}`} style={styles.insightCard}>
      <View style={styles.insightHeader}>
        {getInsightIcon(insight.type)}
        <Text style={styles.insightTitle}>{insight.title}</Text>
        <View style={[styles.severityBadge, { backgroundColor: getSeverityColor(insight.severity) }]}>
          <Text style={styles.severityText}>{insight.severity.toUpperCase()}</Text>
        </View>
      </View>
      <Text style={styles.insightMessage}>{insight.message}</Text>
      {insight.estimatedImpact > 0 && (
        <Text style={styles.insightImpact}>
          Potential impact: ${insight.estimatedImpact.toFixed(2)}/month
        </Text>
      )}
    </View>
  );

  const renderOptimizationSummary = () => (
    <View style={styles.summaryContainer}>
      <View style={styles.summaryHeader}>
        <Brain size={24} color="#3B82F6" />
        <Text style={styles.summaryTitle}>AI Optimization Summary</Text>
      </View>
      
      <View style={styles.summaryStats}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>${monthlyOptimization.toFixed(2)}</Text>
          <Text style={styles.statLabel}>Monthly Savings Potential</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>${yearlyOptimization.toFixed(2)}</Text>
          <Text style={styles.statLabel}>Annual Savings Potential</Text>
        </View>
      </View>
      
      <View style={styles.summaryActions}>
        <Text style={styles.summaryDescription}>
          Based on your usage patterns, we found {recommendations.length} optimization opportunities 
          and {insights.length} important insights about your subscriptions.
        </Text>
      </View>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Brain size={24} color="#3B82F6" />
            <Text style={styles.title}>AI Assistant</Text>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <X size={24} color="#64748B" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <Brain size={48} color="#3B82F6" />
            <Text style={styles.loadingText}>Analyzing your subscriptions...</Text>
            <Text style={styles.loadingSubtext}>
              AI is reviewing usage patterns, costs, and optimization opportunities
            </Text>
          </View>
        ) : (
          <>
            {renderOptimizationSummary()}
            
            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[styles.tab, selectedTab === 'recommendations' && styles.activeTab]}
                onPress={() => setSelectedTab('recommendations')}
              >
                <Text style={[styles.tabText, selectedTab === 'recommendations' && styles.activeTabText]}>
                  Recommendations ({recommendations.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, selectedTab === 'insights' && styles.activeTab]}
                onPress={() => setSelectedTab('insights')}
              >
                <Text style={[styles.tabText, selectedTab === 'insights' && styles.activeTabText]}>
                  Insights ({insights.length})
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              {selectedTab === 'recommendations' && (
                <View style={styles.section}>
                  {recommendations.length > 0 ? (
                    recommendations.map(renderRecommendation)
                  ) : (
                    <View style={styles.emptyState}>
                      <CheckCircle size={48} color="#10B981" />
                      <Text style={styles.emptyStateTitle}>All optimized!</Text>
                      <Text style={styles.emptyStateText}>
                        Your subscriptions are well-optimized. We'll notify you of new opportunities.
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {selectedTab === 'insights' && (
                <View style={styles.section}>
                  {insights.length > 0 ? (
                    insights.map(renderInsight)
                  ) : (
                    <View style={styles.emptyState}>
                      <Brain size={48} color="#3B82F6" />
                      <Text style={styles.emptyStateTitle}>No insights yet</Text>
                      <Text style={styles.emptyStateText}>
                        Keep using your subscriptions and we'll provide personalized insights.
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </ScrollView>
          </>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1E293B',
  },
  closeButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    marginTop: 16,
    textAlign: 'center',
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  summaryContainer: {
    padding: 20,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
  },
  summaryStats: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#10B981',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
  },
  summaryActions: {
    marginTop: 8,
  },
  summaryDescription: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#3B82F6',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
  },
  activeTabText: {
    color: '#3B82F6',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 20,
  },
  recommendationCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  recommendationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  recommendationIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  recommendationInfo: {
    flex: 1,
  },
  recommendationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  recommendationDescription: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
  },
  recommendationSavings: {
    alignItems: 'flex-end',
  },
  savingsAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#10B981',
  },
  savingsLabel: {
    fontSize: 10,
    color: '#64748B',
    textAlign: 'center',
  },
  recommendationDetails: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  confidenceContainer: {
    marginBottom: 12,
  },
  confidenceLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
  },
  confidenceBar: {
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    backgroundColor: '#10B981',
  },
  actionRequired: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1E293B',
    marginBottom: 8,
  },
  reasoningContainer: {
    marginBottom: 12,
  },
  reasoningTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 4,
  },
  reasoningItem: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 2,
  },
  deadlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  deadlineText: {
    fontSize: 12,
    color: '#F59E0B',
    fontWeight: '500',
  },
  insightCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  insightTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  severityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  severityText: {
    fontSize: 10,
    color: '#ffffff',
    fontWeight: '600',
  },
  insightMessage: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
    marginBottom: 4,
  },
  insightImpact: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
});
