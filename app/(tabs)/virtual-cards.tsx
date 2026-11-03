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
import { CreditCard, Eye } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeColors } from '@/constants/theme';
import { useVirtualCardsEnabled } from '@/hooks/useFeatureFlags';
import { virtualCardService } from '@/services/virtualCards';

/**
 * The only card data this screen is allowed to render.
 *
 * A card number, expiry or CVV must never reach the client in the first place
 * (the issuer only hands out `last4` and `brand`), and the screen must not
 * invent one either — see docs/agents/EXECUTION_PLAN.md, card S103.
 */
interface VirtualCardSummary {
  id: string;
  last4?: string;
  brand?: string;
  status?: string;
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

/**
 * Reduce a card payload to the fields we are allowed to show.
 *
 * Anything that is not a recognised plain string is dropped rather than
 * displayed, so an unexpected payload can never leak a card number, an expiry
 * or a CVV into the UI.
 */
const toCardSummary = (raw: unknown): VirtualCardSummary | null => {
  const card = asRecord(raw);
  const id = typeof card.id === 'string' ? card.id : '';
  if (!id) {
    return null;
  }

  return {
    id,
    last4: typeof card.last4 === 'string' ? card.last4 : undefined,
    brand: typeof card.brand === 'string' ? card.brand : undefined,
    status: typeof card.status === 'string' ? card.status : undefined,
  };
};

/**
 * Normalise the list payload.
 *
 * The list endpoint answers with `{ cards: [...] }`; the service is typed as a
 * bare array. Both shapes are accepted, and anything else yields an empty list
 * rather than a partially rendered card.
 */
const toCardSummaries = (payload: unknown): VirtualCardSummary[] => {
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(asRecord(payload).cards)
      ? (asRecord(payload).cards as unknown[])
      : [];

  return list
    .map(toCardSummary)
    .filter((card): card is VirtualCardSummary => card !== null);
};

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
      const payload: unknown = await virtualCardService.getCardsByUser(userId);
      setCards(toCardSummaries(payload));
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
        <View style={styles.centeredContainer}>
          <CreditCard size={48} color={colors.textMuted} />
          <Text style={styles.title}>Virtual Cards</Text>
          <Text style={styles.comingSoonTitle}>Coming soon</Text>
          <Text style={styles.comingSoonText}>
            Secure, single-purpose payment cards for your subscriptions are not available yet.
            We will let you know as soon as they are.
          </Text>
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
          ) : cards.length === 0 ? (
            <View style={styles.emptyState}>
              <CreditCard size={40} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No virtual cards yet</Text>
              <Text style={styles.emptySubtitle}>
                Virtual cards you create for a subscription will show up here.
              </Text>
            </View>
          ) : (
            cards.map((card) => (
              <VirtualCardItem key={card.id} card={card} colors={colors} />
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No transactions to show yet</Text>
            <Text style={styles.emptySubtitle}>
              Transaction history becomes available once your cards are in use.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Virtual Card Item Component
const VirtualCardItem: React.FC<{
  card: VirtualCardSummary;
  colors: ThemeColors;
}> = ({ card, colors }) => {
  const styles = createStyles(colors);
  const tone = statusTone(card.status);
  const toneColor = colors[tone];

  return (
    <View style={[styles.cardItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.cardHeader}>
        <View style={styles.cardInfo}>
          <View style={styles.cardBrand}>
            <CreditCard size={24} color={toneColor} />
            <Text style={[styles.cardBrandText, { color: colors.text }]}>
              {card.brand ? card.brand.toUpperCase() : 'CARD'}
            </Text>
            <Text style={[styles.cardLast4, { color: colors.text }]}>
              •••• {card.last4 ?? '••••'}
            </Text>
          </View>
          {card.status ? (
            <View style={[styles.statusBadge, { backgroundColor: toneColor + '20' }]}>
              <Text style={[styles.statusText, { color: toneColor }]}>
                {card.status.toUpperCase()}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Revealing card details is not implemented yet: the control stays
          disabled and says so, instead of showing invented details. */}
      <TouchableOpacity
        style={styles.revealButton}
        disabled
        accessibilityRole="button"
        accessibilityState={{ disabled: true }}
      >
        <Eye size={18} color={colors.textMuted} />
        <Text style={[styles.revealText, { color: colors.textMuted }]}>
          Card details are shown securely in a later update
        </Text>
      </TouchableOpacity>
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
    paddingVertical: 24,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: colors.textMuted,
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
  revealButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  revealText: {
    fontSize: 14,
    flex: 1,
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
