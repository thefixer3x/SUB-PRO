import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { CreditCard, Eye, EyeOff, Lock, Settings, Plus, DollarSign, Calendar, TrendingDown, TrendingUp } from 'lucide-react-native';
import { VirtualCard, VirtualCardTransaction } from '@/types/embeddedFinance';
import { virtualCardService } from '@/services/virtualCards';
import { useTheme } from '@/contexts/ThemeContext';

interface VirtualCardInlineViewProps {
  subscriptionId: string;
  subscriptionName: string;
  userId: string;
  expanded: boolean;
  onToggle: () => void;
}

export const VirtualCardInlineView: React.FC<VirtualCardInlineViewProps> = ({
  subscriptionId,
  subscriptionName,
  userId,
  expanded,
  onToggle,
}) => {
  const { colors } = useTheme();
  const [card, setCard] = useState<VirtualCard | null>(null);
  const [transactions, setTransactions] = useState<VirtualCardTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCardNumber, setShowCardNumber] = useState(false);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  const styles = createStyles(colors);

  useEffect(() => {
    if (expanded) {
      loadCardData();
    }
  }, [expanded, subscriptionId]);

  const loadCardData = async () => {
    try {
      setLoading(true);
      const cards = await virtualCardService.getCardsBySubscription(subscriptionId);
      if (cards.length > 0) {
        setCard(cards[0]); // Get the primary card for this subscription
        loadTransactions(cards[0].id);
      }
    } catch (error) {
      console.error('Failed to load virtual card:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTransactions = async (cardId: string) => {
    try {
      setLoadingTransactions(true);
      const cardTransactions = await virtualCardService.getCardTransactions(cardId);
      setTransactions(cardTransactions.slice(0, 3)); // Show last 3 transactions
    } catch (error) {
      console.error('Failed to load transactions:', error);
    } finally {
      setLoadingTransactions(false);
    }
  };

  const createVirtualCard = async () => {
    try {
      setLoading(true);
      const newCard = await virtualCardService.createVirtualCard({
        subscriptionId,
        userId,
        spendingLimit: 100,
        nickname: `${subscriptionName} Card`,
      });
      setCard(newCard);
      Alert.alert('Success', 'Virtual card created successfully!');
    } catch (error) {
      console.error('Failed to create virtual card:', error);
      Alert.alert('Error', 'Failed to create virtual card');
    } finally {
      setLoading(false);
    }
  };

  const toggleCardVisibility = () => {
    setShowCardNumber(!showCardNumber);
  };

  const maskCardNumber = (cardNumber: string) => {
    if (!cardNumber) return '•••• •••• •••• ••••';
    return `•••• •••• •••• ${cardNumber.slice(-4)}`;
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'payment':
        return <TrendingDown size={16} color={colors.error} />;
      case 'refund':
        return <TrendingUp size={16} color={colors.success} />;
      default:
        return <DollarSign size={16} color={colors.textMuted} />;
    }
  };

  if (!expanded) {
    return (
      <TouchableOpacity style={styles.collapsedView} onPress={onToggle}>
        <CreditCard size={16} color={colors.primary} />
        <Text style={styles.collapsedText}>
          {card ? 'View Virtual Card' : 'Create Virtual Card'}
        </Text>
        <Text style={styles.expandHint}>Tap to expand</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.expandedView}>
      <TouchableOpacity style={styles.header} onPress={onToggle}>
        <View style={styles.headerLeft}>
          <CreditCard size={18} color={colors.primary} />
          <Text style={styles.headerTitle}>Virtual Card</Text>
        </View>
        <Text style={styles.collapseHint}>Tap to collapse</Text>
      </TouchableOpacity>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Loading card...</Text>
        </View>
      ) : card ? (
        <View style={styles.cardContainer}>
          {/* Virtual Card Display */}
          <View style={styles.virtualCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardNickname}>
                {card.nickname || `${subscriptionName} Card`}
              </Text>
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={toggleCardVisibility}
              >
                {showCardNumber ? (
                  <EyeOff size={16} color={colors.textMuted} />
                ) : (
                  <Eye size={16} color={colors.textMuted} />
                )}
              </TouchableOpacity>
            </View>
            
            <Text style={styles.cardNumber}>
              {showCardNumber ? card.cardNumber : maskCardNumber(card.cardNumber)}
            </Text>
            
            <View style={styles.cardDetails}>
              <View style={styles.cardDetailItem}>
                <Text style={styles.cardDetailLabel}>Expires</Text>
                <Text style={styles.cardDetailValue}>
                  {card.expiryMonth.toString().padStart(2, '0')}/{card.expiryYear.toString().slice(-2)}
                </Text>
              </View>
              <View style={styles.cardDetailItem}>
                <Text style={styles.cardDetailLabel}>CVV</Text>
                <Text style={styles.cardDetailValue}>
                  {showCardNumber ? card.cvv : '•••'}
                </Text>
              </View>
            </View>

            {/* Card Status and Limits */}
            <View style={styles.cardStats}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Status</Text>
                <Text style={[
                  styles.statValue,
                  { color: card.status === 'active' ? colors.success : colors.error }
                ]}>
                  {card.status}
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Limit</Text>
                <Text style={styles.statValue}>{formatAmount(card.spendingLimit)}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Spent</Text>
                <Text style={styles.statValue}>{formatAmount(card.totalSpent || 0)}</Text>
              </View>
            </View>
          </View>

          {/* Recent Transactions */}
          <View style={styles.transactionsSection}>
            <View style={styles.transactionsHeader}>
              <Text style={styles.transactionsTitle}>Recent Transactions</Text>
              {loadingTransactions && (
                <ActivityIndicator size="small" color={colors.primary} />
              )}
            </View>

            {transactions.length > 0 ? (
              <View style={styles.transactionsList}>
                {transactions.map((transaction, index) => (
                  <View key={transaction.id} style={styles.transactionItem}>
                    <View style={styles.transactionIcon}>
                      {getTransactionIcon(transaction.type)}
                    </View>
                    <View style={styles.transactionContent}>
                      <Text style={styles.transactionMerchant}>
                        {transaction.merchantName}
                      </Text>
                      <Text style={styles.transactionDate}>
                        {formatDate(transaction.date)}
                      </Text>
                    </View>
                    <Text style={[
                      styles.transactionAmount,
                      {
                        color: transaction.type === 'refund' 
                          ? colors.success 
                          : colors.error
                      }
                    ]}>
                      {transaction.type === 'refund' ? '+' : '-'}
                      {formatAmount(Math.abs(transaction.amount))}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.noTransactionsText}>
                No transactions yet
              </Text>
            )}
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.actionButton}>
              <Settings size={16} color={colors.primary} />
              <Text style={styles.actionButtonText}>Manage</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionButton, styles.lockButton]}
              onPress={() => {
                Alert.alert(
                  'Lock Card',
                  'Are you sure you want to temporarily lock this card?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Lock', style: 'destructive' },
                  ]
                );
              }}
            >
              <Lock size={16} color={colors.error} />
              <Text style={[styles.actionButtonText, { color: colors.error }]}>
                Lock Card
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        // No card exists - show creation option
        <View style={styles.createCardContainer}>
          <View style={styles.createCardContent}>
            <CreditCard size={32} color={colors.textMuted} />
            <Text style={styles.createCardTitle}>No Virtual Card</Text>
            <Text style={styles.createCardDescription}>
              Create a virtual card for this subscription to enhance security and track spending.
            </Text>
            <TouchableOpacity
              style={styles.createCardButton}
              onPress={createVirtualCard}
              disabled={loading}
            >
              <Plus size={16} color={colors.textInverse} />
              <Text style={styles.createCardButtonText}>Create Virtual Card</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  collapsedView: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 8,
    marginTop: 8,
  },
  collapsedText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    marginLeft: 8,
    flex: 1,
  },
  expandHint: {
    fontSize: 12,
    color: colors.textMuted,
  },
  expandedView: {
    marginTop: 12,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.backgroundSecondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginLeft: 8,
  },
  collapseHint: {
    fontSize: 12,
    color: colors.textMuted,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  loadingText: {
    fontSize: 14,
    color: colors.textMuted,
    marginLeft: 8,
  },
  cardContainer: {
    padding: 16,
  },
  virtualCard: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardNickname: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  eyeButton: {
    padding: 4,
  },
  cardNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 2,
    marginBottom: 16,
    fontFamily: 'monospace',
  },
  cardDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  cardDetailItem: {
    alignItems: 'center',
  },
  cardDetailLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 4,
  },
  cardDetailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cardStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  transactionsSection: {
    marginBottom: 16,
  },
  transactionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  transactionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  transactionsList: {
    gap: 8,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 8,
  },
  transactionIcon: {
    marginRight: 12,
  },
  transactionContent: {
    flex: 1,
  },
  transactionMerchant: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  transactionDate: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  transactionAmount: {
    fontSize: 14,
    fontWeight: '600',
  },
  noTransactionsText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: 16,
    fontStyle: 'italic',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  lockButton: {
    backgroundColor: colors.error + '10',
    borderColor: colors.error + '30',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.primary,
    marginLeft: 6,
  },
  createCardContainer: {
    padding: 24,
  },
  createCardContent: {
    alignItems: 'center',
  },
  createCardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: 12,
    marginBottom: 8,
  },
  createCardDescription: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  createCardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createCardButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textInverse,
    marginLeft: 6,
  },
});
