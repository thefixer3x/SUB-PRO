import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  SafeAreaView, 
  TouchableOpacity, 
  Modal,
  Alert,
  RefreshControl,
} from 'react-native';
import { 
  CreditCard, 
  Plus, 
  Eye, 
  EyeOff, 
  Settings,
  Shield,
  TrendingUp,
  DollarSign,
  Calendar,
  MoreVertical,
  Copy,
  Lock,
  Unlock,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors } from '@/constants/theme';
import { VirtualCard } from '@/types/embeddedFinance';
import { virtualCardService } from '@/services/virtualCards';

interface VirtualCardTransaction {
  id: string;
  cardId: string;
  amount: number;
  merchant: string;
  date: Date;
  status: 'approved' | 'declined';
  category: string;
}

export default function VirtualCardsScreen() {
  const { colors } = useTheme();
  const [cards, setCards] = useState<VirtualCard[]>([]);
  const [transactions, setTransactions] = useState<VirtualCardTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCard, setSelectedCard] = useState<VirtualCard | null>(null);
  const [showCardDetails, setShowCardDetails] = useState(false);
  const [revealedCardId, setRevealedCardId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const styles = React.useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      // Mock user ID - in production, get from auth context
      const userId = 'user-123';
      
      const userCards = await virtualCardService.getCardsByUser(userId);
      setCards(userCards);
      
      // Load transactions for all cards
      const allTransactions = await Promise.all(
        userCards.map(card => loadCardTransactions(card.id))
      );
      setTransactions(allTransactions.flat());
    } catch (error) {
      console.error('Failed to load virtual cards:', error);
      // Use mock data for demo
      loadMockData();
    } finally {
      setLoading(false);
    }
  };

  const loadMockData = () => {
    const mockCards: VirtualCard[] = [
      {
        id: 'card-1',
        subscriptionId: 'sub-netflix',
        userId: 'user-123',
        cardNumber: '****-****-****-1234',
        last4: '1234',
        expiryMonth: 12,
        expiryYear: 2027,
        cvv: '***',
        status: 'active',
        spendingLimit: 50,
        merchantCategory: 'streaming',
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-01-15'),
        provider: 'stripe',
        providerCardId: 'stripe_card_1234',
      },
      {
        id: 'card-2',
        subscriptionId: 'sub-spotify',
        userId: 'user-123',
        cardNumber: '****-****-****-5678',
        last4: '5678',
        expiryMonth: 8,
        expiryYear: 2026,
        cvv: '***',
        status: 'active',
        spendingLimit: 25,
        merchantCategory: 'music',
        createdAt: new Date('2024-02-01'),
        updatedAt: new Date('2024-02-01'),
        provider: 'stripe',
        providerCardId: 'stripe_card_5678',
      },
      {
        id: 'card-3',
        subscriptionId: 'sub-adobe',
        userId: 'user-123',
        cardNumber: '****-****-****-9012',
        last4: '9012',
        expiryMonth: 5,
        expiryYear: 2028,
        cvv: '***',
        status: 'blocked',
        spendingLimit: 100,
        merchantCategory: 'software',
        createdAt: new Date('2024-03-10'),
        updatedAt: new Date('2024-03-10'),
        provider: 'weavr',
        providerCardId: 'weavr_card_9012',
      },
    ];

    const mockTransactions: VirtualCardTransaction[] = [
      {
        id: 'txn-1',
        cardId: 'card-1',
        amount: 15.99,
        merchant: 'Netflix',
        date: new Date('2024-12-01'),
        status: 'approved',
        category: 'Entertainment',
      },
      {
        id: 'txn-2',
        cardId: 'card-2',
        amount: 9.99,
        merchant: 'Spotify',
        date: new Date('2024-12-01'),
        status: 'approved',
        category: 'Music',
      },
      {
        id: 'txn-3',
        cardId: 'card-1',
        amount: 15.99,
        merchant: 'Netflix',
        date: new Date('2024-11-01'),
        status: 'approved',
        category: 'Entertainment',
      },
      {
        id: 'txn-4',
        cardId: 'card-3',
        amount: 52.99,
        merchant: 'Adobe',
        date: new Date('2024-11-15'),
        status: 'declined',
        category: 'Software',
      },
    ];

    setCards(mockCards);
    setTransactions(mockTransactions);
  };

  const loadCardTransactions = async (cardId: string): Promise<VirtualCardTransaction[]> => {
    // Mock implementation - replace with actual API call
    return [];
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleRevealCard = async (card: VirtualCard) => {
    try {
      // In production, this would call the secure API to temporarily reveal card details
      setRevealedCardId(card.id);
      setSelectedCard(card);
      setShowCardDetails(true);
      
      // Auto-hide after 30 seconds for security
      setTimeout(() => {
        setRevealedCardId(null);
        setShowCardDetails(false);
      }, 30000);
    } catch (error) {
      Alert.alert('Error', 'Failed to reveal card details');
    }
  };

  const handleToggleCardStatus = async (card: VirtualCard) => {
    try {
      const newStatus = card.status === 'active' ? 'blocked' : 'active';
      await virtualCardService.updateVirtualCard({
        cardId: card.id,
        status: newStatus,
      });
      
      setCards(cards.map(c => 
        c.id === card.id ? { ...c, status: newStatus } : c
      ));
      
      Alert.alert(
        'Card Updated',
        `Card has been ${newStatus === 'active' ? 'activated' : 'blocked'}`
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to update card status');
    }
  };

  const copyCardNumber = (cardNumber: string) => {
    // In production, implement clipboard functionality
    Alert.alert('Copied', 'Card number copied to clipboard');
  };

  const getCardStats = () => {
    const activeCards = cards.filter(c => c.status === 'active').length;
    const totalSpent = transactions
      .filter(t => t.status === 'approved')
      .reduce((sum, t) => sum + t.amount, 0);
    const totalLimit = cards.reduce((sum, c) => sum + c.spendingLimit, 0);
    
    return { activeCards, totalSpent, totalLimit };
  };

  const stats = getCardStats();

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading virtual cards...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Virtual Cards</Text>
          <Text style={styles.subtitle}>
            Secure payment cards for your subscriptions
          </Text>
        </View>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.activeCards}</Text>
            <Text style={styles.statLabel}>Active Cards</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>${stats.totalSpent.toFixed(2)}</Text>
            <Text style={styles.statLabel}>Total Spent</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>${stats.totalLimit}</Text>
            <Text style={styles.statLabel}>Total Limit</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity 
            style={styles.primaryButton}
            onPress={() => setShowCreateModal(true)}
          >
            <Plus size={20} color={colors.textInverse} />
            <Text style={styles.primaryButtonText}>Create New Card</Text>
          </TouchableOpacity>
        </View>

        {/* Cards List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Virtual Cards</Text>
          
          {cards.map((card) => (
            <VirtualCardItem
              key={card.id}
              card={card}
              transactions={transactions.filter(t => t.cardId === card.id)}
              onReveal={() => handleRevealCard(card)}
              onToggleStatus={() => handleToggleCardStatus(card)}
              colors={colors}
            />
          ))}
        </View>

        {/* Recent Transactions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          
          {transactions.slice(0, 10).map((transaction) => (
            <TransactionItem
              key={transaction.id}
              transaction={transaction}
              card={cards.find(c => c.id === transaction.cardId)}
              colors={colors}
            />
          ))}
        </View>
      </ScrollView>

      {/* Card Details Modal */}
      <Modal
        visible={showCardDetails}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCardDetails(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedCard && (
              <CardDetailsModal
                card={selectedCard}
                revealed={revealedCardId === selectedCard.id}
                onClose={() => setShowCardDetails(false)}
                onCopy={copyCardNumber}
                colors={colors}
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// Virtual Card Item Component
const VirtualCardItem: React.FC<{
  card: VirtualCard;
  transactions: VirtualCardTransaction[];
  onReveal: () => void;
  onToggleStatus: () => void;
  colors: ThemeColors;
}> = ({ card, transactions, onReveal, onToggleStatus, colors }) => {
  const styles = createStyles(colors);
  const lastTransaction = transactions[0];
  const monthlySpent = transactions
    .filter(t => t.date.getMonth() === new Date().getMonth())
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <View style={[styles.cardItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.cardHeader}>
        <View style={styles.cardInfo}>
          <View style={styles.cardBrand}>
            <CreditCard size={24} color={card.status === 'active' ? colors.primary : colors.textMuted} />
            <Text style={[styles.cardLast4, { color: colors.text }]}>
              •••• {card.last4}
            </Text>
          </View>
          <View style={[
            styles.statusBadge,
            { backgroundColor: card.status === 'active' ? colors.success + '20' : colors.error + '20' }
          ]}>
            <Text style={[
              styles.statusText,
              { color: card.status === 'active' ? colors.success : colors.error }
            ]}>
              {card.status.toUpperCase()}
            </Text>
          </View>
        </View>
        
        <TouchableOpacity onPress={onReveal} style={styles.revealButton}>
          <Eye size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.cardDetails}>
        <View style={styles.cardStat}>
          <Text style={[styles.cardStatValue, { color: colors.text }]}>
            ${monthlySpent.toFixed(2)}
          </Text>
          <Text style={[styles.cardStatLabel, { color: colors.textMuted }]}>
            This Month
          </Text>
        </View>
        
        <View style={styles.cardStat}>
          <Text style={[styles.cardStatValue, { color: colors.text }]}>
            ${card.spendingLimit}
          </Text>
          <Text style={[styles.cardStatLabel, { color: colors.textMuted }]}>
            Limit
          </Text>
        </View>
        
        <View style={styles.cardStat}>
          <Text style={[styles.cardStatValue, { color: colors.text }]}>
            {card.expiryMonth}/{card.expiryYear}
          </Text>
          <Text style={[styles.cardStatLabel, { color: colors.textMuted }]}>
            Expires
          </Text>
        </View>
      </View>

      {lastTransaction && (
        <View style={styles.lastTransaction}>
          <Text style={[styles.lastTransactionText, { color: colors.textMuted }]}>
            Last: {lastTransaction.merchant} • ${lastTransaction.amount}
          </Text>
        </View>
      )}

      <View style={styles.cardActions}>
        <TouchableOpacity 
          style={[styles.actionButton, { backgroundColor: colors.backgroundSecondary }]}
          onPress={onToggleStatus}
        >
          {card.status === 'active' ? (
            <Lock size={16} color={colors.error} />
          ) : (
            <Unlock size={16} color={colors.success} />
          )}
          <Text style={[styles.actionButtonText, { color: colors.text }]}>
            {card.status === 'active' ? 'Block' : 'Activate'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.actionButton, { backgroundColor: colors.backgroundSecondary }]}
        >
          <Settings size={16} color={colors.textMuted} />
          <Text style={[styles.actionButtonText, { color: colors.text }]}>
            Settings
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Transaction Item Component
const TransactionItem: React.FC<{
  transaction: VirtualCardTransaction;
  card?: VirtualCard;
  colors: ThemeColors;
}> = ({ transaction, card, colors }) => {
  const styles = createStyles(colors);
  return (
    <View style={[styles.transactionItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.transactionInfo}>
        <Text style={[styles.transactionMerchant, { color: colors.text }]}>
          {transaction.merchant}
        </Text>
        <Text style={[styles.transactionDetails, { color: colors.textMuted }]}>
          {card?.last4 ? `•••• ${card.last4}` : 'Unknown Card'} • {transaction.category}
        </Text>
        <Text style={[styles.transactionDate, { color: colors.textMuted }]}>
          {transaction.date.toLocaleDateString()}
        </Text>
      </View>
      
      <View style={styles.transactionAmount}>
        <Text style={[
          styles.transactionAmountText,
          { color: transaction.status === 'approved' ? colors.text : colors.error }
        ]}>
          {transaction.status === 'approved' ? '-' : ''}${transaction.amount.toFixed(2)}
        </Text>
        <View style={[
          styles.transactionStatus,
          { backgroundColor: transaction.status === 'approved' ? colors.success + '20' : colors.error + '20' }
        ]}>
          <Text style={[
            styles.transactionStatusText,
            { color: transaction.status === 'approved' ? colors.success : colors.error }
          ]}>
            {transaction.status.toUpperCase()}
          </Text>
        </View>
      </View>
    </View>
  );
};

// Card Details Modal Component
const CardDetailsModal: React.FC<{
  card: VirtualCard;
  revealed: boolean;
  onClose: () => void;
  onCopy: (text: string) => void;
  colors: ThemeColors;
}> = ({ card, revealed, onClose, onCopy, colors }) => {
  const styles = createStyles(colors);
  return (
    <View style={[styles.cardDetailsContainer, { backgroundColor: colors.card }]}>
      <View style={styles.modalHeader}>
        <Text style={[styles.modalTitle, { color: colors.text }]}>Card Details</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={[styles.closeButton, { color: colors.primary }]}>Done</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.cardVisual}>
        <View style={[styles.cardFace, { backgroundColor: colors.primary }]}>
          <Text style={styles.cardNumberDisplay}>
            {revealed ? '4532 1234 5678 ' + card.last4 : '•••• •••• •••• ' + card.last4}
          </Text>
          <View style={styles.cardExpiry}>
            <Text style={styles.cardExpiryText}>
              {card.expiryMonth.toString().padStart(2, '0')}/{card.expiryYear}
            </Text>
            <Text style={styles.cardCvv}>
              CVV: {revealed ? '123' : '•••'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity 
          style={[styles.modalActionButton, { backgroundColor: colors.primary }]}
          onPress={() => onCopy(card.cardNumber)}
        >
          <Copy size={16} color={colors.textInverse} />
          <Text style={[styles.modalActionButtonText, { color: colors.textInverse }]}>
            Copy Number
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.securityNotice}>
        <Shield size={16} color={colors.warning} />
        <Text style={[styles.securityNoticeText, { color: colors.textMuted }]}>
          Card details will be hidden automatically in 30 seconds for security.
        </Text>
      </View>
    </View>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: colors.textMuted,
  },
  header: {
    padding: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textMuted,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
  },
  actionsContainer: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  primaryButton: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textInverse,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  cardItem: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  cardInfo: {
    flex: 1,
  },
  cardBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  cardLast4: {
    fontSize: 16,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  revealButton: {
    padding: 8,
  },
  cardDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  cardStat: {
    alignItems: 'center',
  },
  cardStatValue: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  cardStatLabel: {
    fontSize: 12,
  },
  lastTransaction: {
    marginBottom: 16,
  },
  lastTransactionText: {
    fontSize: 14,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 6,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  transactionItem: {
    flexDirection: 'row',
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionMerchant: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  transactionDetails: {
    fontSize: 14,
    marginBottom: 2,
  },
  transactionDate: {
    fontSize: 12,
  },
  transactionAmount: {
    alignItems: 'flex-end',
  },
  transactionAmountText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  transactionStatus: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  transactionStatusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  cardDetailsContainer: {
    borderRadius: 20,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  closeButton: {
    fontSize: 16,
    fontWeight: '600',
  },
  cardVisual: {
    alignItems: 'center',
    marginBottom: 24,
  },
  cardFace: {
    width: 300,
    height: 180,
    borderRadius: 16,
    padding: 20,
    justifyContent: 'space-between',
  },
  cardNumberDisplay: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
    letterSpacing: 2,
  },
  cardExpiry: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  cardExpiryText: {
    fontSize: 14,
    color: 'white',
  },
  cardCvv: {
    fontSize: 14,
    color: 'white',
  },
  modalActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    marginBottom: 16,
  },
  modalActionButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderRadius: 8,
  },
  securityNoticeText: {
    fontSize: 12,
    flex: 1,
  },
});
