import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { useSubscriptions, useInvalidateSubscriptions } from '@/hooks/useSubscriptions';
import { createSubscription } from '@/services/subscriptionService';
import { SUBSCRIPTION_PLANS } from '@/config/subscriptionPlans';
import {
  BILLING_CYCLES,
  CATEGORIES,
  emptyForm,
  isAtSubscriptionLimit,
  toNewSubscription,
  validateSubscriptionForm,
  type SubscriptionFormErrors,
  type SubscriptionFormValues,
} from '@/utils/subscriptionForm';
import type { ThemeColors } from '@/constants/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
}

/** Add one subscription for the signed-in user (owner insert, RLS-checked). */
export function AddSubscriptionModal({ visible, onClose }: Props) {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { currentTier } = useSubscription();
  const { data: subscriptions } = useSubscriptions(user?.id);
  const invalidate = useInvalidateSubscriptions();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const [values, setValues] = useState<SubscriptionFormValues>(() => emptyForm());
  const [errors, setErrors] = useState<SubscriptionFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const limit = SUBSCRIPTION_PLANS[currentTier ?? 'free']?.limits.maxSubscriptions ?? null;
  const atLimit = isAtSubscriptionLimit(subscriptions?.length ?? 0, limit);

  const set = <K extends keyof SubscriptionFormValues>(key: K, value: SubscriptionFormValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const close = () => {
    setValues(emptyForm());
    setErrors({});
    setSaveError(null);
    onClose();
  };

  const save = async () => {
    const found = validateSubscriptionForm(values);
    setErrors(found);
    if (Object.keys(found).length > 0 || !user?.id) return;
    setSaving(true);
    setSaveError(null);
    try {
      await createSubscription(user.id, toNewSubscription(values));
      await invalidate();
      close();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save the subscription.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Add subscription</Text>
            <TouchableOpacity onPress={close} accessibilityRole="button" accessibilityLabel="Close">
              <X size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {atLimit ? (
            <View style={styles.limitBox}>
              <Text style={styles.limitTitle}>Free plan limit reached</Text>
              <Text style={styles.limitText}>
                The Free plan tracks up to {String(limit)} subscriptions. Upgrade to track as many as you like.
              </Text>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => {
                  close();
                  router.push('/(tabs)/upgrade');
                }}
                accessibilityRole="button"
              >
                <Text style={styles.primaryButtonText}>See plans</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled">
              <Field label="Service" error={errors.name} styles={styles}>
                <TextInput
                  style={styles.input}
                  value={values.name}
                  onChangeText={(t) => set('name', t)}
                  placeholder="e.g. Netflix"
                  placeholderTextColor={colors.textMuted}
                  accessibilityLabel="Service name"
                  autoFocus
                />
              </Field>

              <View style={styles.row}>
                <View style={styles.rowWide}>
                  <Field label="Amount per billing cycle" error={errors.amount} styles={styles}>
                    <TextInput
                      style={styles.input}
                      value={values.amount}
                      onChangeText={(t) => set('amount', t)}
                      placeholder="9.99"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="decimal-pad"
                      accessibilityLabel="Amount per billing cycle"
                    />
                  </Field>
                </View>
                <View style={styles.rowNarrow}>
                  <Field label="Currency" error={errors.currency} styles={styles}>
                    <TextInput
                      style={styles.input}
                      value={values.currency}
                      onChangeText={(t) => set('currency', t.toUpperCase())}
                      autoCapitalize="characters"
                      maxLength={3}
                      accessibilityLabel="Currency"
                    />
                  </Field>
                </View>
              </View>

              <Field label="Billing cycle" styles={styles}>
                <Chips
                  options={BILLING_CYCLES}
                  value={values.billingCycle}
                  onChange={(v) => set('billingCycle', v)}
                  styles={styles}
                />
              </Field>

              <Field label="Next renewal (YYYY-MM-DD)" error={errors.renewalDate} styles={styles}>
                <TextInput
                  style={styles.input}
                  value={values.renewalDate}
                  onChangeText={(t) => set('renewalDate', t)}
                  placeholder="2026-12-01"
                  placeholderTextColor={colors.textMuted}
                  accessibilityLabel="Next renewal date"
                />
              </Field>

              <Field label="Category" styles={styles}>
                <Chips
                  options={CATEGORIES}
                  value={values.category}
                  onChange={(v) => set('category', v)}
                  styles={styles}
                />
              </Field>

              {saveError && <Text style={styles.saveError}>{saveError}</Text>}

              <TouchableOpacity
                style={[styles.primaryButton, saving && styles.disabled]}
                onPress={save}
                disabled={saving}
                accessibilityRole="button"
                accessibilityLabel="Save subscription"
              >
                {saving ? (
                  <ActivityIndicator color={colors.textInverse} />
                ) : (
                  <Text style={styles.primaryButtonText}>Save subscription</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

type Styles = ReturnType<typeof createStyles>;

function Field({
  label,
  error,
  children,
  styles,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  styles: Styles;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

function Chips<T extends string>({
  options,
  value,
  onChange,
  styles,
}: {
  options: T[];
  value: T;
  onChange: (v: T) => void;
  styles: Styles;
}) {
  return (
    <View style={styles.chips}>
      {options.map((o) => (
        <TouchableOpacity
          key={o}
          style={[styles.chip, o === value && styles.chipActive]}
          onPress={() => onChange(o)}
          accessibilityRole="button"
          accessibilityState={{ selected: o === value }}
        >
          <Text style={[styles.chipText, o === value && styles.chipTextActive]}>{o}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.4)',
    },
    sheet: {
      maxHeight: '92%',
      backgroundColor: colors.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 20,
      width: '100%',
      maxWidth: 560,
      alignSelf: 'center',
    },
    sheetHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    sheetTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
    field: { marginBottom: 14 },
    label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      color: colors.text,
      backgroundColor: colors.card,
    },
    error: { fontSize: 12, color: colors.error, marginTop: 4 },
    row: { flexDirection: 'row', gap: 12 },
    rowWide: { flex: 2 },
    rowNarrow: { flex: 1 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    chipActive: { borderColor: colors.primary, backgroundColor: colors.selected },
    chipText: { fontSize: 13, color: colors.textSecondary },
    chipTextActive: { color: colors.primary, fontWeight: '600' },
    primaryButton: {
      marginTop: 8,
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: 'center',
    },
    primaryButtonText: { color: colors.textInverse, fontSize: 15, fontWeight: '600' },
    disabled: { opacity: 0.6 },
    saveError: { color: colors.error, fontSize: 13, marginBottom: 8 },
    limitBox: { paddingVertical: 8 },
    limitTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 6 },
    limitText: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  });
