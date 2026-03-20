import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  Brain, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle, 
  DollarSign,
  Calendar,
  PieChart,
  BarChart3,
  Zap,
  Target
} from 'lucide-react-native';

interface Transaction {
  id: string;
  merchant: string;
  amount: number;
  date: string;
  category: string;
  isRecurring: boolean;
  confidence: number;
  subscriptionMatch?: {
    name: string;
    plan: string;
    nextBilling: string;
  };
}

interface AnalysisInsight {
  type: 'savings' | 'warning' | 'optimization' | 'trend';
  title: string;
  description: string;
  impact: number;
  actionable: boolean;
  priority: 'high' | 'medium' | 'low';
}

interface TransactionAnalyzerProps {
  bankConnected?: boolean;
  onConnectBank?: () => void;
  onAnalyzeTransactions?: () => Promise<Transaction[]>;
}

export const TransactionAnalyzer: React.FC<TransactionAnalyzerProps> = ({
  bankConnected = false,
  onConnectBank,
  onAnalyzeTransactions
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [insights, setInsights] = useState<AnalysisInsight[]>([]);
  const [analysisComplete, setAnalysisComplete] = useState(false);

  // Mock data for demonstration
  const mockTransactions: Transaction[] = [
    {
      id: '1',
      merchant: 'Netflix',
      amount: 15.99,
      date: '2024-01-15',
      category: 'Entertainment',
      isRecurring: true,
      confidence: 0.95,
      subscriptionMatch: {
        name: 'Netflix',
        plan: 'Premium',
        nextBilling: '2024-02-15'
      }
    },
    {
      id: '2',
      merchant: 'Spotify Premium',
      amount: 9.99,
      date: '2024-01-20',
      category: 'Music',
      isRecurring: true,
      confidence: 0.92,
      subscriptionMatch: {
        name: 'Spotify',
        plan: 'Premium',
        nextBilling: '2024-02-20'
      }
    },
    {
      id: '3',
      merchant: 'Adobe Creative Cloud',
      amount: 52.99,
      date: '2024-01-10',
      category: 'Software',
      isRecurring: true,
      confidence: 0.98,
      subscriptionMatch: {
        name: 'Adobe Creative Cloud',
        plan: 'All Apps',
        nextBilling: '2024-02-10'
      }
    }
  ];

  const mockInsights: AnalysisInsight[] = [
    {
      type: 'savings',
      title: 'Duplicate Streaming Services',
      description: 'You have 3 streaming services. Consider consolidating to save $25/month.',
      impact: 25,
      actionable: true,
      priority: 'high'
    },
    {
      type: 'optimization',
      title: 'Annual Plan Savings',
      description: 'Switch to annual billing for Adobe CC to save $127/year.',
      impact: 127,
      actionable: true,
      priority: 'medium'
    },
    {
      type: 'warning',
      title: 'Unused Subscription Detected',
      description: 'LinkedIn Premium shows no recent activity. Last used 45 days ago.',
      impact: 29.99,
      actionable: true,
      priority: 'high'
    },
    {
      type: 'trend',
      title: 'Spending Increase',
      description: 'Your subscription spending increased 15% this month.',
      impact: 0,
      actionable: false,
      priority: 'low'
    }
  ];

  const analyzeTransactions = async () => {
    setIsAnalyzing(true);
    
    try {
      if (onAnalyzeTransactions) {
        const result = await onAnalyzeTransactions();
        setTransactions(result);
        // Only show real insights when real data is available.
        // Mock insights after a real analysis is misleading (PR review).
        setInsights([]);
      } else {
        // Demo mode — show mock data with a clear label
        setTransactions(mockTransactions);
        setInsights(mockInsights);
      }
      setAnalysisComplete(true);
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'savings': return <DollarSign size={20} color="#10B981" />;
      case 'warning': return <AlertCircle size={20} color="#F59E0B" />;
      case 'optimization': return <Target size={20} color="#3B82F6" />;
      case 'trend': return <TrendingUp size={20} color="#8B5CF6" />;
      default: return <Brain size={20} color="#6B7280" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return '#EF4444';
      case 'medium': return '#F59E0B';
      case 'low': return '#10B981';
      default: return '#6B7280';
    }
  };

  if (!bankConnected) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.connectCard}
        >
          <Brain size={48} color="white" />
          <Text style={styles.connectTitle}>AI Transaction Analysis</Text>
          <Text style={styles.connectDescription}>
            Connect your bank account to automatically detect subscriptions and get personalized insights.
          </Text>
          <TouchableOpacity style={styles.connectButton} onPress={onConnectBank}>
            <Text style={styles.connectButtonText}>Connect Bank Account</Text>
            <Zap size={20} color="#667eea" />
          </TouchableOpacity>
        </LinearGradient>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Transaction Analysis</Text>
        <Text style={styles.headerSubtitle}>AI-powered subscription detection</Text>
      </View>

      {!analysisComplete && (
        <TouchableOpacity 
          style={styles.analyzeButton} 
          onPress={analyzeTransactions}
          disabled={isAnalyzing}
        >
          <LinearGradient
            colors={['#4facfe', '#00f2fe']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.analyzeGradient}
          >
            {isAnalyzing ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Brain size={24} color="white" />
            )}
            <Text style={styles.analyzeButtonText}>
              {isAnalyzing ? 'Analyzing...' : 'Analyze Transactions'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      )}

      {analysisComplete && (
        <>
          {/* Insights Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>AI Insights</Text>
            {insights.map((insight, index) => (
              <View key={index} style={styles.insightCard}>
                <View style={styles.insightHeader}>
                  {getInsightIcon(insight.type)}
                  <View style={styles.insightTitleContainer}>
                    <Text style={styles.insightTitle}>{insight.title}</Text>
                    <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(insight.priority) }]}>
                      <Text style={styles.priorityText}>{insight.priority.toUpperCase()}</Text>
                    </View>
                  </View>
                </View>
                <Text style={styles.insightDescription}>{insight.description}</Text>
                {insight.impact > 0 && (
                  <Text style={styles.impactText}>
                    Potential savings: ${insight.impact}/month
                  </Text>
                )}
                {insight.actionable && (
                  <TouchableOpacity style={styles.actionButton}>
                    <Text style={styles.actionButtonText}>Take Action</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>

          {/* Detected Subscriptions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Detected Subscriptions</Text>
            {transactions.map((transaction) => (
              <View key={transaction.id} style={styles.transactionCard}>
                <View style={styles.transactionHeader}>
                  <Text style={styles.merchantName}>{transaction.merchant}</Text>
                  <Text style={styles.transactionAmount}>${transaction.amount}</Text>
                </View>
                <View style={styles.transactionDetails}>
                  <Text style={styles.transactionCategory}>{transaction.category}</Text>
                  <View style={styles.confidenceContainer}>
                    <CheckCircle size={16} color="#10B981" />
                    <Text style={styles.confidenceText}>
                      {Math.round(transaction.confidence * 100)}% confidence
                    </Text>
                  </View>
                </View>
                {transaction.subscriptionMatch && (
                  <View style={styles.matchInfo}>
                    <Calendar size={14} color="#6B7280" />
                    <Text style={styles.nextBilling}>
                      Next billing: {new Date(transaction.subscriptionMatch.nextBilling).toLocaleDateString()}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        </>
      )}
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
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#64748b',
  },
  connectCard: {
    margin: 20,
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
  },
  connectTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: 'white',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  connectDescription: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  connectButton: {
    backgroundColor: 'white',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  connectButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#667eea',
    marginRight: 8,
  },
  analyzeButton: {
    margin: 20,
    borderRadius: 16,
    overflow: 'hidden',
  },
  analyzeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  analyzeButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
    marginLeft: 8,
  },
  section: {
    padding: 20,
    paddingTop: 0,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 16,
  },
  insightCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  insightTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginLeft: 12,
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    flex: 1,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'white',
  },
  insightDescription: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
    marginBottom: 8,
  },
  impactText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
    marginBottom: 8,
  },
  actionButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
  transactionCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  merchantName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#3B82F6',
  },
  transactionDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  transactionCategory: {
    fontSize: 14,
    color: '#64748b',
  },
  confidenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  confidenceText: {
    fontSize: 12,
    color: '#10B981',
    marginLeft: 4,
    fontWeight: '500',
  },
  matchInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nextBilling: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
  },
});
