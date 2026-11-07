import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { AlertCircle, Check, Plus, RefreshCw, Sparkles, X } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { useTheme } from '@/contexts/ThemeContext';
import type { InsightRecord } from '@/types/planInbox';
import type { EnvelopeSummary } from '@/services/envelopeMath';
import {
  createEnvelope,
  getEnvelopeSummary,
  getInsightConsent,
  getInsights,
  PlanInboxApiError,
  scanForInsights,
  updateInsight,
  updateInsightConsent,
} from '@/services/planInboxApi';
import { fromMinorUnits, toMinorUnits } from '@/services/insightEngine';
import { parseEnvelopeAmount } from '@/services/envelopeMath';

const titleForType: Record<string, string> = {
  price_increase: 'Price increase',
  new_recurring_merchant: 'New recurring charge',
  unused_before_renewal: 'Renewal coming up',
  duplicate_subscription: 'Possible duplicate',
  envelope_at_risk: 'Envelope may run over',
};

function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function PlanInbox({ currency = 'USD' }: { currency?: string }) {
  const { session } = useAuth();
  const { currentTier, isLoading: isTierLoading } = useSubscription();
  const { colors } = useTheme();
  const router = useRouter();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [consentEnabled, setConsentEnabled] = useState<boolean | null>(null);
  const [insights, setInsights] = useState<InsightRecord[]>([]);
  const [envelopes, setEnvelopes] = useState<EnvelopeSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEnvelopeForm, setShowEnvelopeForm] = useState(false);
  const [envelopeName, setEnvelopeName] = useState('');
  const [envelopeAmount, setEnvelopeAmount] = useState('');
  const [envelopeCategory, setEnvelopeCategory] = useState('');

  const accessToken = session?.access_token;
  const canAccept = currentTier === 'pro' || currentTier === 'team';
  const tierKnown = !isTierLoading && currentTier !== undefined;

  const loadData = useCallback(async (
    token: string,
    scan: boolean,
    isActive: () => boolean = () => true,
  ) => {
    setError(null);
    const consent = await getInsightConsent(token);
    if (!isActive()) return;
    setConsentEnabled(consent.enabled);
    if (!consent.enabled) {
      setInsights([]);
      const nextEnvelopes = await getEnvelopeSummary(token);
      if (isActive()) setEnvelopes(nextEnvelopes);
      return;
    }

    let scanError: unknown = null;
    if (scan) {
      try {
        await scanForInsights(token);
      } catch (error) {
        scanError = error;
      }
      if (!isActive()) return;
    }
    const [nextInsights, nextEnvelopes] = await Promise.all([
      getInsights(token),
      getEnvelopeSummary(token),
    ]);
    if (!isActive()) return;
    setInsights(nextInsights);
    setEnvelopes(nextEnvelopes);
    if (scanError) {
      setError(scanError instanceof Error ? scanError.message : 'Could not check for new insights.');
    }
  }, []);

  useEffect(() => {
    let active = true;
    if (!accessToken) {
      setConsentEnabled(false);
      setIsLoading(false);
      return () => { active = false; };
    }

    setIsLoading(true);
    void loadData(accessToken, true, () => active)
      .catch((loadError: unknown) => {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : 'Could not load your plan inbox.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => { active = false; };
  }, [accessToken, loadData]);

  const refresh = useCallback(async () => {
    if (!accessToken) return;
    setIsChecking(true);
    try {
      await loadData(accessToken, true);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not check for new insights.');
    } finally {
      setIsChecking(false);
    }
  }, [accessToken, loadData]);

  const changeConsent = useCallback(async (enabled: boolean) => {
    if (!accessToken) return;
    setIsSaving(true);
    setError(null);
    try {
      await updateInsightConsent(accessToken, enabled);
      setConsentEnabled(enabled);
      if (enabled) {
        const [nextInsights, nextEnvelopes] = await Promise.all([
          getInsights(accessToken),
          getEnvelopeSummary(accessToken),
        ]);
        setInsights(nextInsights);
        setEnvelopes(nextEnvelopes);
      } else {
        setInsights([]);
      }
    } catch (saveError) {
      try {
        const currentConsent = await getInsightConsent(accessToken);
        setConsentEnabled(currentConsent.enabled);
        if (!currentConsent.enabled) setInsights([]);
      } catch {
        // Preserve the original mutation error; the user can retry the load.
      }
      setError(saveError instanceof Error ? saveError.message : 'Could not update your preference.');
    } finally {
      setIsSaving(false);
    }
  }, [accessToken]);

  const handleInsightAction = useCallback(async (insight: InsightRecord, action: 'accept' | 'dismiss') => {
    if (!accessToken) return;
    setError(null);
    try {
      const updated = await updateInsight(accessToken, insight.id, action);
      setInsights((current) => current.map((row) => row.id === updated.id ? updated : row));
    } catch (actionError) {
      if (actionError instanceof PlanInboxApiError && actionError.status === 403) {
        router.push('/(tabs)/upgrade');
        return;
      }
      setError(actionError instanceof Error ? actionError.message : 'Could not update this insight.');
    }
  }, [accessToken, router]);

  const handleCreateEnvelope = useCallback(async () => {
    if (!accessToken) return;
    const amount = parseEnvelopeAmount(envelopeAmount, currency);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter a monthly amount greater than zero.');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await createEnvelope(accessToken, {
        name: envelopeName,
        currency: currency.toUpperCase(),
        monthly_amount_minor: toMinorUnits(amount, currency),
        category_filter: envelopeCategory.trim() || null,
      });
      setEnvelopeName('');
      setEnvelopeAmount('');
      setEnvelopeCategory('');
      setShowEnvelopeForm(false);
      setEnvelopes(await getEnvelopeSummary(accessToken));
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Could not create this envelope.');
    } finally {
      setIsSaving(false);
    }
  }, [accessToken, currency, envelopeAmount, envelopeCategory, envelopeName]);

  const visibleInsights = insights.filter((insight) => insight.status !== 'dismissed');

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Sparkles size={19} color={colors.primary} />
          <Text style={styles.title}>Plan inbox</Text>
        </View>
        {consentEnabled && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Check for new insights"
            disabled={isChecking || isLoading}
            onPress={() => void refresh()}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            {isChecking
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <RefreshCw size={17} color={colors.primary} />}
          </Pressable>
        )}
      </View>
      <Text style={styles.subtitle}>
        Insights are free. Accepting an insight is a Pro action; nothing changes automatically.
      </Text>

      {error && (
        <View style={styles.errorBox}>
          <AlertCircle size={16} color={colors.error} />
          <Text selectable style={styles.errorText}>{error}</Text>
        </View>
      )}

      {isLoading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.mutedText}>Loading your plan inbox…</Text>
        </View>
      ) : consentEnabled === false ? (
        <View style={styles.consentCard}>
          <Text style={styles.cardTitle}>Turn on spending insights</Text>
          <Text style={styles.bodyText}>
            SubTrack will check your subscriptions and recent card authorizations on our server to find patterns like price changes and unused renewals. Card numbers, security codes, and credentials are never used. You can turn this off anytime; saved insights will be removed.
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={isSaving || !accessToken}
            onPress={() => void changeConsent(true)}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, isSaving && styles.disabled]}
          >
            {isSaving ? <ActivityIndicator size="small" color={colors.textInverse} /> : <Check size={16} color={colors.textInverse} />}
            <Text style={styles.primaryButtonText}>Turn on insights</Text>
          </Pressable>
        </View>
      ) : consentEnabled ? (
        <>
          <View style={styles.consentSummary}>
            <Text style={styles.mutedText}>Spending insights are on</Text>
            <Pressable
              accessibilityRole="button"
              disabled={isSaving || isChecking || isLoading}
              onPress={() => void changeConsent(false)}
              hitSlop={8}
            >
              <Text style={styles.textButton}>Turn off</Text>
            </Pressable>
          </View>

          {visibleInsights.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.cardTitle}>No insights yet</Text>
              <Text style={styles.bodyText}>
                We’ll check again when you refresh. Price and recurring-charge insights need enough test-mode card activity; they’ll appear as that history builds.
              </Text>
            </View>
          ) : visibleInsights.map((insight) => (
            <InsightCard
              key={insight.id}
              insight={insight}
              canAccept={canAccept}
              tierKnown={tierKnown}
              onAccept={() => void handleInsightAction(insight, 'accept')}
              onDismiss={() => void handleInsightAction(insight, 'dismiss')}
              onUpgrade={() => router.push('/(tabs)/upgrade')}
              colors={colors}
              styles={styles}
            />
          ))}
        </>
      ) : null}

      <View style={styles.envelopeHeader}>
        <View>
          <Text style={styles.cardTitle}>Monthly set-asides</Text>
          <Text style={styles.mutedText}>Budgets only — no money is held. Card-linked spend is test-mode only.</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add a monthly set-aside"
          onPress={() => setShowEnvelopeForm((shown) => !shown)}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          {showEnvelopeForm ? <X size={18} color={colors.primary} /> : <Plus size={18} color={colors.primary} />}
        </Pressable>
      </View>

      {showEnvelopeForm && (
        <View style={styles.formCard}>
          <Text style={styles.inputLabel}>Name</Text>
          <TextInput
            accessibilityLabel="Set-aside name"
            value={envelopeName}
            onChangeText={setEnvelopeName}
            placeholder="Streaming"
            placeholderTextColor={colors.textMuted}
            maxLength={80}
            style={styles.input}
          />
          <Text style={styles.inputLabel}>Monthly amount ({currency.toUpperCase()})</Text>
          <TextInput
            accessibilityLabel="Monthly amount in dollars"
            value={envelopeAmount}
            onChangeText={setEnvelopeAmount}
            placeholder="30.00"
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
            style={styles.input}
          />
          <Text style={styles.inputLabel}>Card category (optional)</Text>
          <TextInput
            accessibilityLabel="Card category filter"
            value={envelopeCategory}
            onChangeText={setEnvelopeCategory}
            placeholder="streaming"
            placeholderTextColor={colors.textMuted}
            maxLength={80}
            style={styles.input}
          />
          <Pressable
            accessibilityRole="button"
            disabled={isSaving}
            onPress={() => void handleCreateEnvelope()}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, isSaving && styles.disabled]}
          >
            {isSaving ? <ActivityIndicator size="small" color={colors.textInverse} /> : <Plus size={16} color={colors.textInverse} />}
            <Text style={styles.primaryButtonText}>Create set-aside</Text>
          </Pressable>
        </View>
      )}

      {envelopes.length === 0 ? (
        <Text style={styles.emptyText}>Create a set-aside to track monthly spend by category.</Text>
      ) : envelopes.map((summary) => {
        const { envelope, spent_minor: spent, remaining_minor: remaining, projected_minor: projected } = summary;
        const ratio = envelope.monthly_amount_minor > 0
          ? Math.min(spent / envelope.monthly_amount_minor, 1)
          : 0;
        const atLimit = spent > envelope.monthly_amount_minor;
        return (
          <View key={envelope.id} style={styles.envelopeCard}>
            <View style={styles.envelopeSummaryRow}>
              <View style={styles.envelopeNameColumn}>
                <Text style={styles.envelopeName}>{envelope.name}</Text>
                <Text style={styles.mutedText}>
                  {formatCurrency(fromMinorUnits(spent, envelope.currency), envelope.currency)} of {formatCurrency(fromMinorUnits(envelope.monthly_amount_minor, envelope.currency), envelope.currency)}
                </Text>
              </View>
              <Text style={[styles.remaining, atLimit && styles.overLimit]}>
                {remaining < 0 ? 'Over by ' : ''}{formatCurrency(fromMinorUnits(Math.abs(remaining), envelope.currency), envelope.currency)}
              </Text>
            </View>
            <View accessibilityLabel={`${envelope.name} monthly spend progress`} style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${ratio * 100}%` }, atLimit && styles.progressOver]} />
            </View>
            {summary.days_left > 0 && projected > envelope.monthly_amount_minor && (
              <Text style={styles.warningText}>
                On pace for {formatCurrency(fromMinorUnits(projected, envelope.currency), envelope.currency)} this month.
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

function InsightCard({
  insight,
  canAccept,
  tierKnown,
  onAccept,
  onDismiss,
  onUpgrade,
  colors,
  styles,
}: {
  insight: InsightRecord;
  canAccept: boolean;
  tierKnown: boolean;
  onAccept: () => void;
  onDismiss: () => void;
  onUpgrade: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
  styles: ReturnType<typeof createStyles>;
}) {
  const title = titleForType[insight.type] ?? 'Subscription insight';
  const isAccepted = insight.status === 'accepted';

  return (
    <View style={styles.insightCard}>
      <View style={styles.insightHeader}>
        <Text style={styles.insightTitle}>{title}</Text>
        {isAccepted ? (
          <View style={styles.acceptedBadge}>
            <Check size={13} color={colors.success} />
            <Text style={styles.acceptedText}>Accepted</Text>
          </View>
        ) : (
          <Text style={styles.newBadge}>New</Text>
        )}
      </View>
      <Text selectable style={styles.bodyText}>{insight.explanation}</Text>
      {!isAccepted && (
        <View style={styles.actionRow}>
          <Pressable accessibilityRole="button" onPress={onDismiss} hitSlop={8}>
            <Text style={styles.textButton}>Dismiss</Text>
          </Pressable>
          {!tierKnown ? (
            <Text style={styles.mutedText}>Checking plan access…</Text>
          ) : canAccept ? (
            <Pressable accessibilityRole="button" onPress={onAccept} style={styles.actionButton}>
              <Check size={14} color={colors.primary} />
              <Text style={styles.actionButtonText}>Accept</Text>
            </Pressable>
          ) : (
            <Pressable accessibilityRole="button" onPress={onUpgrade} style={styles.actionButton}>
              <Text style={styles.actionButtonText}>Accept · Pro</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  section: {
    gap: 12,
    marginHorizontal: 20,
    marginBottom: 24,
    padding: 16,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
  subtitle: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.selected,
  },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.55 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 },
  consentCard: {
    gap: 10,
    padding: 14,
    backgroundColor: colors.cardSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyCard: { gap: 6, padding: 14, backgroundColor: colors.cardSecondary, borderRadius: 12 },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  bodyText: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  mutedText: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  consentSummary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  textButton: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  primaryButton: {
    alignSelf: 'flex-start',
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  primaryButtonText: { color: colors.textInverse, fontSize: 13, fontWeight: '700' },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: colors.backgroundSecondary,
  },
  errorText: { color: colors.error, flex: 1, fontSize: 12, lineHeight: 17 },
  emptyText: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  insightCard: {
    gap: 9,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.cardSecondary,
  },
  insightHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  insightTitle: { color: colors.text, fontSize: 14, fontWeight: '700', flex: 1 },
  newBadge: {
    color: colors.primary,
    backgroundColor: colors.selected,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 11,
    fontWeight: '700',
    overflow: 'hidden',
  },
  acceptedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  acceptedText: { color: colors.success, fontSize: 11, fontWeight: '700' },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  actionButton: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, borderRadius: 8, backgroundColor: colors.selected },
  actionButtonText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  envelopeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6 },
  formCard: { gap: 8, padding: 14, backgroundColor: colors.cardSecondary, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  inputLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  input: {
    minHeight: 42,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 9,
    color: colors.text,
    backgroundColor: colors.card,
    fontSize: 14,
  },
  envelopeCard: { gap: 9, padding: 12, borderRadius: 12, backgroundColor: colors.cardSecondary },
  envelopeSummaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  envelopeNameColumn: { flex: 1, gap: 2 },
  envelopeName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  remaining: { color: colors.textSecondary, fontSize: 12, fontVariant: ['tabular-nums'] },
  overLimit: { color: colors.error },
  progressTrack: { height: 7, overflow: 'hidden', borderRadius: 8, backgroundColor: colors.borderLight },
  progressFill: { height: '100%', borderRadius: 8, backgroundColor: colors.primary },
  progressOver: { backgroundColor: colors.error },
  warningText: { color: colors.warning, fontSize: 12 },
});
