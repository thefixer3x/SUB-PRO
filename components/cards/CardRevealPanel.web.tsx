import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { loadStripe, type Stripe, type StripeElement } from '@stripe/stripe-js';
import { useTheme } from '@/contexts/ThemeContext';
import { stripeConfig } from '@/config/stripe';
import { virtualCardService } from '@/services/virtualCards';
import { confirmCardAction } from './cardSecurity';
import { STRIPE_ELEMENTS_API_VERSION } from './stripeElementsVersion';

interface Props {
  cardId: string;
}

let stripePromise: Promise<Stripe | null> | null = null;
const getStripe = () => {
  if (!stripePromise) {
    stripePromise = stripeConfig.publishableKey
      ? loadStripe(stripeConfig.publishableKey, { apiVersion: STRIPE_ELEMENTS_API_VERSION })
      : Promise.resolve(null);
  }
  return stripePromise;
};

const HIDE_AFTER_MS = 60_000;

/**
 * Web: show the full number, expiry and CVC through Stripe Issuing Elements.
 *
 * Flow: re-check the session -> Stripe.js makes a nonce -> our API checks
 * ownership and returns a short-lived key for this one card -> Stripe's
 * iframes fetch and draw the details. The number and CVC never enter this
 * component's state, our API responses or our logs. The details hide again
 * after a minute.
 */
export function CardRevealPanel({ cardId }: Props) {
  const { colors } = useTheme();
  const [state, setState] = useState<'hidden' | 'loading' | 'shown'>('hidden');
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef<StripeElement[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ids = {
    number: `card-number-${cardId}`,
    expiry: `card-expiry-${cardId}`,
    cvc: `card-cvc-${cardId}`,
  };

  const hide = () => {
    mounted.current.forEach((el) => el.destroy());
    mounted.current = [];
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setState('hidden');
  };

  useEffect(() => hide, []); // eslint-disable-line react-hooks/exhaustive-deps

  const reveal = async () => {
    setError(null);
    setState('loading');
    try {
      if (!(await confirmCardAction('Show card details'))) {
        throw new Error('Your session has expired. Please sign in again.');
      }
      const stripe = await getStripe();
      if (!stripe) throw new Error('Card details are not available right now.');

      const nonceResult = await stripe.createEphemeralKeyNonce({ issuingCard: cardId });
      if (!nonceResult.nonce) throw new Error('Card details are not available right now.');

      const key = await virtualCardService.createRevealKey(
        cardId,
        nonceResult.nonce,
        STRIPE_ELEMENTS_API_VERSION,
      );

      const elements = stripe.elements();
      const common = {
        issuingCard: cardId,
        nonce: nonceResult.nonce,
        ephemeralKeySecret: key.secret,
        style: { base: { color: colors.text, fontSize: '16px' } },
      };
      setState('shown');
      // Wait one frame so the mount targets exist in the DOM.
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      const number = elements.create('issuingCardNumberDisplay', common);
      const expiry = elements.create('issuingCardExpiryDisplay', common);
      const cvc = elements.create('issuingCardCvcDisplay', common);
      number.mount(`#${ids.number}`);
      expiry.mount(`#${ids.expiry}`);
      cvc.mount(`#${ids.cvc}`);
      mounted.current = [number, expiry, cvc];
      timer.current = setTimeout(hide, HIDE_AFTER_MS);
    } catch (e) {
      hide();
      setError(e instanceof Error ? e.message : 'Card details are not available right now.');
    }
  };

  return (
    <View style={styles.box}>
      {state === 'shown' && (
        <View style={[styles.details, { borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.textMuted }]}>Card number</Text>
          <View nativeID={ids.number} style={styles.slot} />
          <View style={styles.row}>
            <View style={styles.half}>
              <Text style={[styles.label, { color: colors.textMuted }]}>Expiry</Text>
              <View nativeID={ids.expiry} style={styles.slot} />
            </View>
            <View style={styles.half}>
              <Text style={[styles.label, { color: colors.textMuted }]}>CVC</Text>
              <View nativeID={ids.cvc} style={styles.slot} />
            </View>
          </View>
          <Text style={[styles.note, { color: colors.textMuted }]}>Hides automatically after 1 minute.</Text>
        </View>
      )}
      {error && <Text style={[styles.error, { color: colors.error }]}>{error}</Text>}
      <TouchableOpacity
        style={styles.button}
        onPress={state === 'shown' ? hide : reveal}
        disabled={state === 'loading'}
        accessibilityRole="button"
        accessibilityLabel={state === 'shown' ? 'Hide card details' : 'Show card details'}
      >
        {state === 'loading' ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : state === 'shown' ? (
          <EyeOff size={18} color={colors.primary} />
        ) : (
          <Eye size={18} color={colors.primary} />
        )}
        <Text style={[styles.buttonText, { color: colors.primary }]}>
          {state === 'shown' ? 'Hide card details' : 'Show card details'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { marginTop: 12 },
  details: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 8 },
  label: { fontSize: 12, marginBottom: 4 },
  slot: { minHeight: 24, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 16 },
  half: { flex: 1 },
  note: { fontSize: 11 },
  error: { fontSize: 13, marginBottom: 6 },
  button: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  buttonText: { fontSize: 14, fontWeight: '600' },
});
