import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { CheckCircle } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useSubscription } from '@/hooks/useSubscription';
import { SUBSCRIPTION_PLANS } from '@/config/subscriptionPlans';

/** How often, and how many times, to re-read the tier while the webhook lands. */
export const TIER_POLL_INTERVAL_MS = 2000;
export const TIER_POLL_MAX_ATTEMPTS = 10;

export default function BillingSuccess() {
  const { session_id } = useLocalSearchParams<{ session_id?: string }>();
  const { colors } = useTheme();
  // The shared provider state, so FeatureGate and every screen see the new tier.
  const { currentTier, refreshTier } = useSubscription();
  const attempts = useRef(0);
  const [gaveUp, setGaveUp] = useState(false);

  const isPaid = currentTier === 'pro' || currentTier === 'team';

  // Stripe redirects here before (or while) the webhook writes the tier, so
  // re-read it on a fixed interval until a paid tier appears or we give up.
  useEffect(() => {
    if (isPaid || gaveUp) return;
    const timer = setInterval(() => {
      if (attempts.current >= TIER_POLL_MAX_ATTEMPTS) {
        clearInterval(timer);
        setGaveUp(true);
        return;
      }
      attempts.current += 1;
      refreshTier();
    }, TIER_POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [isPaid, gaveUp, refreshTier]);

  const planName = isPaid && currentTier ? SUBSCRIPTION_PLANS[currentTier].name : null;
  const subtitle = planName
    ? `Thank you! Your ${planName} plan is now active.`
    : gaveUp
      ? 'Thank you! Your payment went through. Your plan can take a minute to activate; reopen the app if features are still locked.'
      : 'Thank you! Activating your plan…';

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      marginTop: 24,
      color: colors.text,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      marginTop: 8,
      textAlign: 'center',
      paddingHorizontal: 32,
    },
    sessionId: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 16,
      fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    button: {
      backgroundColor: colors.primary,
      paddingHorizontal: 32,
      paddingVertical: 14,
      borderRadius: 12,
      marginTop: 32,
    },
    buttonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <CheckCircle size={80} color="#10B981" />
        <Text style={styles.title}>Payment Successful!</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        {session_id && (
          <Text style={styles.sessionId}>
            Session: {session_id.substring(0, 20)}...
          </Text>
        )}
        <TouchableOpacity
          style={styles.button}
          onPress={() => {
            if (Platform.OS === 'web') {
              router.replace('/(tabs)/index');
            } else {
              router.replace('/(tabs)/index');
            }
          }}
        >
          <Text style={styles.buttonText}>Go to Dashboard</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
