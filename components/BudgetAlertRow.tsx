import React, { useState, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Switch, 
  TextInput, 
  Modal, 
  Alert,
  Platform 
} from 'react-native';
import { DollarSign, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';
import { TYPOGRAPHY, TEXT_COLORS, SPACING } from '@/constants/Typography';

interface BudgetAlertRowProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  budgetLimit: number | null;
  onBudgetChange: (limit: number | null) => void;
  currency?: string;
}

export const BudgetAlertRow: React.FC<BudgetAlertRowProps> = ({
  enabled,
  onToggle,
  budgetLimit,
  onBudgetChange,
  currency = 'USD',
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [inputValue, setInputValue] = useState(budgetLimit?.toString() || '');
  const [inputError, setInputError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const getCurrencySymbol = (currencyCode: string): string => {
    const symbols: Record<string, string> = {
      USD: '$',
      EUR: '€',
      GBP: '£',
      JPY: '¥',
    };
    return symbols[currencyCode] || '$';
  };

  const validateInput = (value: string): boolean => {
    if (!value.trim()) {
      setInputError('Budget limit is required when alerts are enabled');
      return false;
    }

    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue < 0) {
      setInputError('Please enter a valid positive number');
      return false;
    }

    setInputError(null);
    return true;
  };

  const handleToggle = async (newValue: boolean) => {
    // Trigger haptic feedback
    if (Platform.OS !== 'web') {
      await Haptics.selectionAsync();
    }

    if (newValue && !budgetLimit) {
      // Show modal to set budget limit
      setInputValue('');
      setInputError(null);
      setModalVisible(true);
      return;
    }

    onToggle(newValue);
  };

  const handleModalConfirm = async () => {
    if (!validateInput(inputValue)) {
      return;
    }

    setIsLoading(true);
    try {
      const numValue = parseFloat(inputValue);
      
      // Save to SecureStore
      await SecureStore.setItemAsync('budgetLimit', numValue.toString());
      
      onBudgetChange(numValue);
      onToggle(true);
      setModalVisible(false);
      
      // Success haptic feedback
      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to save budget limit. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleModalCancel = () => {
    setModalVisible(false);
    setInputError(null);
  };

  const handleInputChange = (text: string) => {
    // Allow numbers, optional leading negative, and decimal point
    const filteredText = text.replace(/[^0-9.-]/g, '');

    const decimalParts = filteredText.split('.');
    if (decimalParts.length > 2) {
      return;
    }

    const negativeCount = (filteredText.match(/-/g) ?? []).length;
    if (negativeCount > 1) {
      return;
    }

    if (filteredText.includes('-') && filteredText.indexOf('-') > 0) {
      return;
    }

    setInputValue(filteredText);

    // Clear error when user starts typing
    if (inputError) {
      setInputError(null);
    }
  };

  return (
    <>
      <View style={styles.container}>
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <DollarSign size={20} color="#F59E0B" />
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.title}>Budget Alerts</Text>
            <Text style={styles.subtitle}>
              {budgetLimit 
                ? `Warn when spending exceeds ${getCurrencySymbol(currency)}${budgetLimit.toFixed(2)}`
                : 'Warn when spending exceeds budget'
              }
            </Text>
          </View>
        </View>
        <Switch
          testID="budget-alert-switch"
          value={enabled}
          onValueChange={handleToggle}
          trackColor={{ false: '#E5E7EB', true: '#3B82F6' }}
          thumbColor="#ffffff"
          ios_backgroundColor="#E5E7EB"
        />
      </View>

      {budgetLimit && enabled && (
        <TouchableOpacity 
          style={styles.editContainer}
          onPress={() => {
            setInputValue(budgetLimit.toString());
            setInputError(null);
            setModalVisible(true);
          }}
        >
          <Text style={styles.editText}>
            Tap to edit budget limit
          </Text>
        </TouchableOpacity>
      )}

      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onShow={() => {
          // Focus input when modal opens
          setTimeout(() => {
            inputRef.current?.focus();
          }, 100);
        }}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={handleModalCancel}
            >
              <X size={24} color="#64748B" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Set Budget Limit</Text>
            <TouchableOpacity 
              style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
              onPress={handleModalConfirm}
              disabled={isLoading}
            >
              <Text style={[styles.saveButtonText, isLoading && styles.saveButtonTextDisabled]}>
                {isLoading ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <Text style={styles.modalDescription}>
              Set your monthly spending limit. You'll receive a notification when your 
              subscription costs approach this amount.
            </Text>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Monthly Budget Limit</Text>
              <View style={[styles.inputWrapper, inputError && styles.inputWrapperError]}>
                <Text style={styles.currencySymbol}>{getCurrencySymbol(currency)}</Text>
                <TextInput
                  ref={inputRef}
                  style={styles.input}
                  value={inputValue}
                  onChangeText={handleInputChange}
                  placeholder="0.00"
                  placeholderTextColor="#94A3B8"
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                  onSubmitEditing={handleModalConfirm}
                />
              </View>
              {inputError && (
                <Text style={styles.errorText}>{inputError}</Text>
              )}
            </View>

            <View style={styles.infoContainer}>
              <Text style={styles.infoText}>
                💡 This limit helps you stay aware of your spending but won't prevent 
                new subscriptions from being added.
              </Text>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFBEB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.lg,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    ...TYPOGRAPHY.bodyMedium,
    fontFamily: 'Inter-SemiBold',
    color: TEXT_COLORS.primary,
    marginBottom: 2,
  },
  subtitle: {
    ...TYPOGRAPHY.small,
    color: TEXT_COLORS.muted,
  },
  editContainer: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  editText: {
    ...TYPOGRAPHY.caption,
    color: '#3B82F6',
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  cancelButton: {
    padding: SPACING.sm,
  },
  modalTitle: {
    ...TYPOGRAPHY.cardHeader,
    color: TEXT_COLORS.primary,
  },
  saveButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
  },
  saveButtonDisabled: {
    backgroundColor: '#E2E8F0',
  },
  saveButtonText: {
    ...TYPOGRAPHY.button,
    color: TEXT_COLORS.inverse,
  },
  saveButtonTextDisabled: {
    color: '#94A3B8',
  },
  modalContent: {
    flex: 1,
    padding: SPACING.xl,
  },
  modalDescription: {
    ...TYPOGRAPHY.bodyMedium,
    color: TEXT_COLORS.muted,
    lineHeight: 22,
    marginBottom: SPACING['2xl'],
  },
  inputContainer: {
    marginBottom: SPACING['2xl'],
  },
  inputLabel: {
    ...TYPOGRAPHY.label,
    color: TEXT_COLORS.primary,
    marginBottom: SPACING.sm,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  inputWrapperError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  currencySymbol: {
    ...TYPOGRAPHY.bodyMedium,
    color: TEXT_COLORS.primary,
    marginRight: SPACING.xs,
  },
  input: {
    ...TYPOGRAPHY.input,
    color: TEXT_COLORS.primary,
    flex: 1,
  },
  errorText: {
    ...TYPOGRAPHY.caption,
    color: '#EF4444',
    marginTop: SPACING.xs,
  },
  infoContainer: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: SPACING.lg,
  },
  infoText: {
    ...TYPOGRAPHY.small,
    color: '#1E40AF',
    lineHeight: 18,
  },
});