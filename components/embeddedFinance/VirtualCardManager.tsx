import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Alert } from 'react-native';
import { CreditCard, Eye, EyeOff, Lock, Plus, Settings } from 'lucide-react-native';
import { VirtualCard } from '@/types/embeddedFinance';
import { virtualCardService } from '@/services/virtualCards';

interface VirtualCardManagerProps {
  subscriptionId: string;
  userId: string;
  visible: boolean;
  onClose: () => void;
}

export const VirtualCardManager: React.FC<VirtualCardManagerProps> = ({
  subscriptionId,
  userId,
  visible,
  onClose,
}) => {
  const [cards, setCards] = useState<VirtualCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCardDetails, setShowCardDetails] = useState<string | null>(null);
  const [revealedCard, setRevealedCard] = useState<any>(null);

  useEffect(() => {
    if (visible) {
      loadCards();
    }
  }, [visible, subscriptionId]);

  const loadCards = async () => {
    try {
      setLoading(true);
      const subscriptionCards = await virtualCardService.getCardsBySubscription(subscriptionId);
      setCards(subscriptionCards);
    } catch (error) {
      console.error('Failed to load virtual cards:', error);
      Alert.alert('Error', 'Failed to load virtual cards');
    } finally {
      setLoading(false);
    }
  };

  const createCard = async () => {
    try {
      setLoading(true);
      const newCard = await virtualCardService.createVirtualCard({
        subscriptionId,
        userId,
        spendingLimit: 100, // Default $100 limit
      });
      
      setCards(prev => [...prev, newCard]);
      Alert.alert('Success', 'Virtual card created successfully');
    } catch (error) {
      console.error('Failed to create virtual card:', error);
      Alert.alert('Error', 'Failed to create virtual card');
    } finally {
      setLoading(false);
    }
  };

  const revealCardDetails = async (cardId: string) => {
    try {
      const details = await virtualCardService.revealCardDetails(cardId, 'payment');
      setRevealedCard({ cardId, ...details });
      
      // Auto-hide after 30 seconds for security
      setTimeout(() => {
        setRevealedCard(null);
      }, 30000);
    } catch (error) {
      console.error('Failed to reveal card details:', error);
      Alert.alert('Error', 'Failed to reveal card details');
    }
  };

  const blockCard = async (cardId: string) => {
    try {
      await virtualCardService.blockVirtualCard(cardId);
      await loadCards();
      Alert.alert('Success', 'Card blocked successfully');
    } catch (error) {
      console.error('Failed to block card:', error);
      Alert.alert('Error', 'Failed to block card');
    }
  };

  const unblockCard = async (cardId: string) => {
    try {
      await virtualCardService.unblockVirtualCard(cardId);
      await loadCards();
      Alert.alert('Success', 'Card unblocked successfully');
    } catch (error) {
      console.error('Failed to unblock card:', error);
      Alert.alert('Error', 'Failed to unblock card');
    }
  };

  const formatCardNumber = (cardNumber: string, reveal: boolean = false) => {
    if (reveal && revealedCard?.cardId === showCardDetails) {
      return cardNumber.replace(/(.{4})/g, '$1 ').trim();
    }
    return `•••• •••• •••• ${cardNumber}`;
  };

  const renderCard = (card: VirtualCard) => {
    const isRevealed = revealedCard?.cardId === card.id;
    const isBlocked = card.status === 'blocked';

    return (
      <View key={card.id} style={[styles.cardContainer, isBlocked && styles.blockedCard]}>
        <View style={styles.cardHeader}>
          <CreditCard size={24} color={isBlocked ? "#94A3B8" : "#3B82F6"} />
          <Text style={[styles.cardProvider, isBlocked && styles.blockedText]}>
            {card.provider.toUpperCase()}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(card.status) }]}>
            <Text style={styles.statusText}>{card.status}</Text>
          </View>
        </View>

        <View style={styles.cardNumber}>
          <Text style={[styles.cardNumberText, isBlocked && styles.blockedText]}>
            {isRevealed 
              ? formatCardNumber(revealedCard.cardNumber, true)
              : formatCardNumber(card.last4)
            }
          </Text>
          <TouchableOpacity
            style={styles.revealButton}
            onPress={() => revealCardDetails(card.id)}
            disabled={isBlocked}
          >
            {isRevealed ? (
              <EyeOff size={20} color="#64748B" />
            ) : (
              <Eye size={20} color="#64748B" />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.cardDetails}>
          <View style={styles.expiryContainer}>
            <Text style={[styles.expiryLabel, isBlocked && styles.blockedText]}>Expires</Text>
            <Text style={[styles.expiryText, isBlocked && styles.blockedText]}>
              {String(card.expiryMonth).padStart(2, '0')}/{card.expiryYear}
            </Text>
          </View>
          
          <View style={styles.cvvContainer}>
            <Text style={[styles.cvvLabel, isBlocked && styles.blockedText]}>CVV</Text>
            <Text style={[styles.cvvText, isBlocked && styles.blockedText]}>
              {isRevealed ? revealedCard.cvv : '•••'}
            </Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <Text style={[styles.limitText, isBlocked && styles.blockedText]}>
            Limit: ${card.spendingLimit}/month
          </Text>
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.settingsButton]}
              onPress={() => {/* Open card settings */}}
            >
              <Settings size={16} color="#64748B" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.actionButton,
                isBlocked ? styles.unblockButton : styles.blockButton
              ]}
              onPress={() => isBlocked ? unblockCard(card.id) : blockCard(card.id)}
            >
              <Lock size={16} color="#ffffff" />
              <Text style={styles.actionButtonText}>
                {isBlocked ? 'Unblock' : 'Block'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#10B981';
      case 'blocked': return '#EF4444';
      case 'expired': return '#F59E0B';
      default: return '#64748B';
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Virtual Cards</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Done</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <View style={styles.infoSection}>
            <Text style={styles.infoTitle}>Secure Payment Cards</Text>
            <Text style={styles.infoText}>
              Virtual cards are generated specifically for this subscription, 
              providing enhanced security and spending control.
            </Text>
          </View>

          {cards.length === 0 ? (
            <View style={styles.emptyState}>
              <CreditCard size={48} color="#94A3B8" />
              <Text style={styles.emptyTitle}>No Virtual Cards</Text>
              <Text style={styles.emptySubtitle}>
                Create a virtual card to securely manage this subscription's payments
              </Text>
              <TouchableOpacity 
                style={styles.createButton}
                onPress={createCard}
                disabled={loading}
              >
                <Plus size={20} color="#ffffff" />
                <Text style={styles.createButtonText}>Create Virtual Card</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {cards.map(renderCard)}
              
              <TouchableOpacity 
                style={styles.addCardButton}
                onPress={createCard}
                disabled={loading}
              >
                <Plus size={20} color="#3B82F6" />
                <Text style={styles.addCardText}>Add Another Card</Text>
              </TouchableOpacity>
            </>
          )}

          <View style={styles.securityNote}>
            <Lock size={16} color="#64748B" />
            <Text style={styles.securityText}>
              Card details are encrypted and only revealed when needed for payments
            </Text>
          </View>
        </View>
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
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1E293B',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3B82F6',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  infoSection: {
    marginBottom: 24,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1E293B',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 40,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  cardContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  blockedCard: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardProvider: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginLeft: 8,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  cardNumber: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  cardNumberText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    fontFamily: 'monospace',
  },
  revealButton: {
    padding: 8,
  },
  cardDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  expiryContainer: {
    alignItems: 'center',
  },
  expiryLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
  },
  expiryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  cvvContainer: {
    alignItems: 'center',
  },
  cvvLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
  },
  cvvText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    fontFamily: 'monospace',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  limitText: {
    fontSize: 12,
    color: '#64748B',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  settingsButton: {
    backgroundColor: '#F1F5F9',
  },
  blockButton: {
    backgroundColor: '#EF4444',
  },
  unblockButton: {
    backgroundColor: '#10B981',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  blockedText: {
    color: '#94A3B8',
  },
  addCardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
  },
  addCardText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
    marginTop: 20,
    gap: 8,
  },
  securityText: {
    fontSize: 12,
    color: '#64748B',
    flex: 1,
  },
});