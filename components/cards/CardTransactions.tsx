import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { virtualCardService, type VirtualCardTransaction } from '@/services/virtualCards';

/** Minor units -> display string, in the authorization's own currency. */
export function formatMinor(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(
      amount / 100,
    );
  } catch {
    return `${currency.toUpperCase()} ${(amount / 100).toFixed(2)}`;
  }
}

/** Authorizations on one card, as recorded by the Stripe webhook. */
export function CardTransactions({ cardId }: { cardId: string }) {
  const { colors } = useTheme();
  const [rows, setRows] = useState<VirtualCardTransaction[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    setError(null);
    virtualCardService
      .getCardTransactions(cardId)
      .then((r) => !cancelled && setRows(r))
      .catch(() => !cancelled && setError('Could not load transactions.'));
    return () => {
      cancelled = true;
    };
  }, [cardId]);

  if (error) return <Text style={[styles.muted, { color: colors.error }]}>{error}</Text>;
  if (!rows) return <ActivityIndicator size="small" color={colors.primary} style={styles.loader} />;
  if (rows.length === 0) {
    return (
      <Text style={[styles.muted, { color: colors.textMuted }]}>
        No transactions on this card yet.
      </Text>
    );
  }

  return (
    <View style={styles.list}>
      {rows.map((t) => (
        <View key={t.id} style={[styles.row, { borderBottomColor: colors.borderLight }]}>
          <View style={styles.main}>
            <Text style={[styles.merchant, { color: colors.text }]} numberOfLines={1}>
              {t.merchantName || 'Unknown merchant'}
            </Text>
            <Text style={[styles.meta, { color: colors.textMuted }]}>
              {t.date ? new Date(t.date).toLocaleDateString() : ''}
              {t.approved ? '' : ' · Declined'}
              {t.livemode ? '' : ' · Test'}
            </Text>
          </View>
          <Text style={[styles.amount, { color: t.approved ? colors.text : colors.textMuted }]}>
            {formatMinor(t.amount, t.currency)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  loader: { marginVertical: 8 },
  muted: { fontSize: 13, marginTop: 8 },
  list: { marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1 },
  main: { flex: 1, marginRight: 8 },
  merchant: { fontSize: 14, fontWeight: '500' },
  meta: { fontSize: 12, marginTop: 2 },
  amount: { fontSize: 14, fontWeight: '600' },
});
