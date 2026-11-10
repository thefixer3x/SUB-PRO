import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { CreditCard, Copy, Snowflake, Play, ChevronDown, ChevronUp } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeColors } from '@/constants/theme';
import { useVirtualCardsEnabled } from '@/hooks/useFeatureFlags';
import { virtualCardService, type VirtualCardSummary } from '@/services/virtualCards';
import { CardRevealPanel } from '@/components/cards/CardRevealPanel';
import { CardTransactions } from '@/components/cards/CardTransactions';
import { confirmCardAction } from '@/components/cards/cardSecurity';
import { FeaturePreviewCard } from '@/components/features/FeaturePreviewCard';
import { getFeature } from '@/config/featureCatalog';

// What the card features will do. Descriptions only: no sample card is drawn,
// so nothing on this screen can be mistaken for a real card.
const CARD_PREVIEWS = ['virtual-cards', 'card-freeze', 'cancellation-assistant']
  .map((id) => getFeature(id))
  .filter((f): f is NonNullable<typeof f> => !!f);

const statusTone = (status?: string): 'success' | 'warning' | 'error' => {
  switch (status) {
    case 'active':
      return 'success';
    case 'inactive':
      return 'warning';
    default:
      return 'error';
  }
};

export default function VirtualCardsScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { enabled: virtualCardsEnabled, isLoading: flagLoading } = useVirtualCardsEnabled();

  const [cards, setCards] = useState<VirtualCardSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listComplete, setListComplete] = useState(true);

  const styles = useMemo(() => createStyles(colors), [colors]);

  const loadCards = useCallback(async () => {
    const userId = user?.id;
    if (!userId) {
      setCards([]);
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const result = await virtualCardService.listCards();
      setCards(result.cards);
      setListComplete(result.complete);
    } catch (caught) {
      console.error('Failed to load virtual cards:', caught);
      setCards([]);
      setError('We could not load your virtual cards. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!virtualCardsEnabled) {
      return;
    }
    setLoading(true);
    void loadCards();
  }, [virtualCardsEnabled, loadCards]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadCards();
    setRefreshing(false);
  }, [loadCards]);

  if (flagLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading virtual cards...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!virtualCardsEnabled) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.previewContent}>
          <View style={styles.previewHeader}>
            <CreditCard size={40} color={colors.primary} />
            <Text style={styles.title}>Virtual Cards</Text>
            <Text style={styles.comingSoonTitle}>Coming soon</Text>
            <Text style={styles.comingSoonText}>
              Pay each subscription with its own card, and stop a charge without touching
              your bank card. Here is what you will be able to do.
            </Text>
          </View>
          {CARD_PREVIEWS.map((feature) => (
            <FeaturePreviewCard key={feature.id} feature={feature} />
          ))}
        </ScrollView>
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
        <View style={styles.header}>
          <Text style={styles.title}>Virtual Cards</Text>
          <Text style={styles.subtitle}>
            Secure payment cards for your subscriptions
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Virtual Cards</Text>

          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading virtual cards...</Text>
            </View>
          ) : error ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>{error}</Text>
              <Text style={styles.emptySubtitle}>Pull down to try again.</Text>
            </View>
          ) : cards.length === 0 && listComplete ? (
            <View style={styles.emptyState}>
              <CreditCard size={40} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No virtual cards yet</Text>
              <Text style={styles.emptySubtitle}>
                Virtual cards you create for a subscription will show up here.
              </Text>
            </View>
          ) : (
            <>
              {cards.map((card) => (
                <VirtualCardItem key={card.id} card={card} colors={colors} onChanged={loadCards} />
              ))}
              {!listComplete && (
                <Text style={styles.emptySubtitle}>
                  Some of your cards could not be loaded. Pull down to try again.
                </Text>
              )}
            </>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// Virtual Card Item Component
//
// Shows last4, brand, status and expiry only. The full number and CVC are
// drawn by Stripe on web (CardRevealPanel) and never shown in the native app.
const VirtualCardItem: React.FC<{
  card: VirtualCardSummary;
  colors: ThemeColors;
  onChanged: () => void;
}> = ({ card, colors, onChanged }) => {
  const styles = createStyles(colors);
  const tone = statusTone(card.status);
  const toneColor = colors[tone];
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showTransactions, setShowTransactions] = useState(false);
  const locked = card.status === 'inactive';
  const canceled = card.status === 'canceled';

  const copyLast4 = async () => {
    // Only the last 4 digits are ever copied.
    await Clipboard.setStringAsync(card.last4);
    setMessage('Last 4 digits copied.');
  };

  const toggleLock = async () => {
    setMessage(null);
    setBusy(true);
    try {
      const check = await confirmCardAction(locked ? 'Unfreeze card' : 'Freeze card');
      if (check === 'no_device_lock') {
        setMessage('Set up a screen lock (PIN, Face ID or fingerprint) on this device to change cards.');
        return;
      }
      if (check !== 'confirmed') {
        setMessage('Not confirmed. The card was not changed.');
        return;
      }
      await virtualCardService.setCardLocked(card.id, !locked);
      onChanged();
    } catch {
      setMessage('Could not update the card. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View
      style={[styles.cardItem, { backgroundColor: colors.card, borderColor: colors.border }]}
      testID={`virtual-card-${card.id}`}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardInfo}>
          <View style={styles.cardBrand}>
            <CreditCard size={24} color={toneColor} />
            <Text style={[styles.cardBrandText, { color: colors.text }]}>{card.brand.toUpperCase()}</Text>
            <Text style={[styles.cardLast4, { color: colors.text }]}>•••• {card.last4}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: toneColor + '20' }]}>
            <Text style={[styles.statusText, { color: toneColor }]}>
              {locked ? 'FROZEN' : card.status.toUpperCase()}
            </Text>
          </View>
        </View>
        {card.expMonth && card.expYear ? (
          <Text style={[styles.expiry, { color: colors.textMuted }]}>
            Expires {String(card.expMonth).padStart(2, '0')}/{String(card.expYear).slice(-2)}
          </Text>
        ) : null}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.action} onPress={copyLast4} accessibilityRole="button" accessibilityLabel="Copy last 4 digits">
          <Copy size={16} color={colors.primary} />
          <Text style={[styles.actionText, { color: colors.primary }]}>Copy last 4</Text>
        </TouchableOpacity>
        {!canceled && (
          <TouchableOpacity
            style={styles.action}
            onPress={toggleLock}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={locked ? 'Unfreeze card' : 'Freeze card'}
          >
            {locked ? <Play size={16} color={colors.success} /> : <Snowflake size={16} color={colors.info} />}
            <Text style={[styles.actionText, { color: locked ? colors.success : colors.info }]}>
              {busy ? 'Saving…' : locked ? 'Unfreeze' : 'Freeze'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {message && <Text style={[styles.message, { color: colors.textMuted }]}>{message}</Text>}

      {!canceled && <CardRevealPanel cardId={card.id} />}

      <TouchableOpacity
        style={styles.action}
        onPress={() => setShowTransactions((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={showTransactions ? 'Hide transactions' : 'Show transactions'}
      >
        {showTransactions ? <ChevronUp size={16} color={colors.textMuted} /> : <ChevronDown size={16} color={colors.textMuted} />}
        <Text style={[styles.actionText, { color: colors.textMuted }]}>Transactions</Text>
      </TouchableOpacity>
      {showTransactions && <CardTransactions cardId={card.id} />}
    </View>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  expiry: {
    fontSize: 12,
    marginTop: 6,
  },
  actions: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 12,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  message: {
    fontSize: 13,
    marginTop: 4,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: colors.textMuted,
  },
  previewContent: {
    padding: 20,
    paddingBottom: 100,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  previewHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
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
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: colors.textMuted,
  },
  comingSoonTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  comingSoonText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
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
    marginBottom: 12,
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
  cardBrandText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
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
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginTop: 12,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
