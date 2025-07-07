import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { CreditCard, Calendar, DollarSign, Settings, AlertCircle, CheckCircle } from 'lucide-react-native';
import { embeddedCreditService } from '@/services/embeddedCredit';
import { EmbeddedCreditAccount, MonthlySettlement, EmbeddedCreditTransaction } from '@/types/embeddedCredit';

interface EmbeddedCreditViewProps {
  subscriptionId: string;
  subscriptionName: string;
  subscriptionCost: number;
  userId: string;
  expanded: boolean;
  onToggle: () => void;
}

export function EmbeddedCreditView({
  subscriptionId,
  subscriptionName,
  subscriptionCost,
  userId,
  expanded,
  onToggle,
}: EmbeddedCreditViewProps) {
  const [creditAccount, setCreditAccount] = useState<EmbeddedCreditAccount | null>(null);
  const [monthlySettlement, setMonthlySettlement] = useState<MonthlySettlement | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<EmbeddedCreditTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [isEnabledForSubscription, setIsEnabledForSubscription] = useState(false);

  useEffect(() => {
    loadCreditData();
  }, [userId]);

  const loadCreditData = async () => {
    setLoading(true);
    try {
      const account = await embeddedCreditService.getCreditAccount(userId);
      setCreditAccount(account);

      if (account) {
        const settlement = await embeddedCreditService.getMonthlySettlement(account.id);
        setMonthlySettlement(settlement);

        const transactions = await embeddedCreditService.getTransactionHistory(account.id, 5);
        setRecentTransactions(transactions);

        // Check if this subscription is already enabled for credit
        const subscriptionTransactions = transactions.filter(t => t.subscriptionId === subscriptionId);
        setIsEnabledForSubscription(subscriptionTransactions.length > 0);
      }
    } catch (error) {
      console.error('Failed to load credit data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEnableCredit = async () => {
    if (!creditAccount) return;

    try {
      await embeddedCreditService.enableSubscriptionCredit(
        creditAccount.id,
        subscriptionId,
        subscriptionCost,
        subscriptionName
      );
      setIsEnabledForSubscription(true);
      loadCreditData(); // Refresh data
    } catch (error) {
      console.error('Failed to enable credit:', error);
    }
  };

  const handleCreateAccount = async () => {
    try {
      const newAccount = await embeddedCreditService.createCreditAccount(userId);
      setCreditAccount(newAccount);
    } catch (error) {
      console.error('Failed to create credit account:', error);
    }
  };

  if (!creditAccount) {
    return (
      <View style={styles.container}>
        <TouchableOpacity style={styles.header} onPress={onToggle}>
          <View style={styles.headerLeft}>
            <CreditCard size={20} color="#10B981" />
            <Text style={styles.headerTitle}>Embedded Finance</Text>
          </View>
          <Text style={styles.headerSubtitle}>Apply for Credit Service</Text>
        </TouchableOpacity>

        {expanded && (
          <View style={styles.content}>
            <View style={styles.promoCard}>
              <Text style={styles.promoTitle}>💳 SubTrack Credit Service</Text>
              <Text style={styles.promoDescription}>
                We'll pay for your subscriptions upfront, and you settle all payments monthly in one convenient transaction.
              </Text>
              
              <View style={styles.benefitsList}>
                <View style={styles.benefit}>
                  <CheckCircle size={16} color="#10B981" />
                  <Text style={styles.benefitText}>Simplified monthly billing</Text>
                </View>
                <View style={styles.benefit}>
                  <CheckCircle size={16} color="#10B981" />
                  <Text style={styles.benefitText}>No missed subscription payments</Text>
                </View>
                <View style={styles.benefit}>
                  <CheckCircle size={16} color="#10B981" />
                  <Text style={styles.benefitText}>Automatic subscription management</Text>
                </View>
                <View style={styles.benefit}>
                  <CheckCircle size={16} color="#10B981" />
                  <Text style={styles.benefitText}>Credit limit up to $25,000</Text>
                </View>
              </View>

              <TouchableOpacity style={styles.applyButton} onPress={handleCreateAccount}>
                <Text style={styles.applyButtonText}>Apply for Credit Service</Text>
              </TouchableOpacity>

              <Text style={styles.disclaimer}>
                Subject to credit approval. Terms and conditions apply.
              </Text>
            </View>
          </View>
        )}
      </View>
    );
  }

  const availablePercentage = ((creditAccount.availableCredit / creditAccount.creditLimit) * 100);
  
  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.header} onPress={onToggle}>
        <View style={styles.headerLeft}>
          <CreditCard size={20} color="#10B981" />
          <Text style={styles.headerTitle}>Embedded Finance</Text>
          {isEnabledForSubscription && (
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>Active</Text>
            </View>
          )}
        </View>
        <Text style={styles.availableCredit}>
          ${creditAccount.availableCredit.toLocaleString()} available
        </Text>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.content}>
          {/* Credit Account Overview */}
          <View style={styles.accountOverview}>
            <View style={styles.creditLimitBar}>
              <View style={styles.creditLimitBackground}>
                <View 
                  style={[
                    styles.creditLimitFill, 
                    { width: `${Math.min(100 - availablePercentage, 100)}%` }
                  ]} 
                />
              </View>
              <Text style={styles.creditLimitText}>
                ${creditAccount.currentBalance.toLocaleString()} of ${creditAccount.creditLimit.toLocaleString()} used
              </Text>
            </View>

            {monthlySettlement && (
              <View style={styles.settlementInfo}>
                <Calendar size={16} color="#64748B" />
                <Text style={styles.settlementText}>
                  Next settlement: {new Date(monthlySettlement.dueDate).toLocaleDateString()} 
                  • ${monthlySettlement.totalAmount.toLocaleString()}
                </Text>
              </View>
            )}
          </View>

          {/* Subscription Credit Actions */}
          {!isEnabledForSubscription ? (
            <View style={styles.enableSection}>
              <Text style={styles.enableTitle}>Enable for {subscriptionName}</Text>
              <Text style={styles.enableDescription}>
                We'll automatically pay ${subscriptionCost} for {subscriptionName} each month. 
                You'll settle with your other subscriptions on {creditAccount.nextSettlementDate}.
              </Text>
              <TouchableOpacity style={styles.enableButton} onPress={handleEnableCredit}>
                <Text style={styles.enableButtonText}>Enable Credit Payment</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.activeSection}>
              <View style={styles.activeHeader}>
                <CheckCircle size={20} color="#10B981" />
                <Text style={styles.activeTitle}>Credit Payment Active</Text>
              </View>
              <Text style={styles.activeDescription}>
                We're automatically paying ${subscriptionCost} for {subscriptionName}. 
                Next charge will be included in your {creditAccount.nextSettlementDate} settlement.
              </Text>
            </View>
          )}

          {/* Recent Credit Transactions */}
          {recentTransactions.length > 0 && (
            <View style={styles.transactionsSection}>
              <Text style={styles.transactionsTitle}>Recent Transactions</Text>
              {recentTransactions.slice(0, 3).map((transaction) => (
                <View key={transaction.id} style={styles.transactionItem}>
                  <View style={styles.transactionLeft}>
                    <Text style={styles.transactionVendor}>{transaction.vendorName}</Text>
                    <Text style={styles.transactionDate}>
                      {new Date(transaction.transactionDate).toLocaleDateString()}
                    </Text>
                  </View>
                  <Text style={styles.transactionAmount}>
                    -${transaction.amount.toLocaleString()}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Account Settings */}
          <TouchableOpacity style={styles.settingsButton}>
            <Settings size={16} color="#64748B" />
            <Text style={styles.settingsText}>Manage Credit Account</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    marginVertical: 8,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    marginLeft: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#64748B',
  },
  statusBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },
  statusText: {
    fontSize: 12,
    color: '#15803D',
    fontWeight: '500',
  },
  availableCredit: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
  },
  content: {
    padding: 16,
    paddingTop: 0,
  },
  promoCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  promoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 8,
  },
  promoDescription: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
    marginBottom: 16,
  },
  benefitsList: {
    marginBottom: 20,
  },
  benefit: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  benefitText: {
    fontSize: 14,
    color: '#475569',
    marginLeft: 8,
  },
  applyButton: {
    backgroundColor: '#10B981',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  applyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  disclaimer: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  accountOverview: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  creditLimitBar: {
    marginBottom: 12,
  },
  creditLimitBackground: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  creditLimitFill: {
    height: '100%',
    backgroundColor: '#EF4444',
    borderRadius: 4,
  },
  creditLimitText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
  },
  settlementInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settlementText: {
    fontSize: 12,
    color: '#64748B',
    marginLeft: 6,
  },
  enableSection: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  enableTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 8,
  },
  enableDescription: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
    marginBottom: 16,
  },
  enableButton: {
    backgroundColor: '#10B981',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  enableButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  activeSection: {
    backgroundColor: '#DCFCE7',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  activeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  activeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#15803D',
    marginLeft: 8,
  },
  activeDescription: {
    fontSize: 14,
    color: '#166534',
    lineHeight: 20,
  },
  transactionsSection: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  transactionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 12,
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  transactionLeft: {
    flex: 1,
  },
  transactionVendor: {
    fontSize: 14,
    fontWeight: '500',
    color: '#0F172A',
  },
  transactionDate: {
    fontSize: 12,
    color: '#64748B',
  },
  transactionAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  settingsText: {
    fontSize: 14,
    color: '#64748B',
    marginLeft: 6,
  },
});
