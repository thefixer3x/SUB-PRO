import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  SafeAreaView, 
  TouchableOpacity,
  Platform 
} from 'react-native';
import { ChevronLeft, Bell, Calendar, Mail } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { TYPOGRAPHY, TEXT_COLORS, SPACING } from '@/constants/Typography';

// Conditionally import SecureStore for platform compatibility
let SecureStore: any;
if (Platform.OS !== 'web') {
  SecureStore = require('expo-secure-store');
} else {
  SecureStore = {
    getItemAsync: async () => null,
    setItemAsync: async () => {},
  };
}

type ReminderTiming = '1' | '3' | '7';
type ReportDay = 'monday' | 'friday';

interface ReminderSettings {
  renewalTiming: ReminderTiming;
  reportDay: ReportDay;
}

const REMINDER_OPTIONS = [
  { value: '1' as ReminderTiming, label: '1 day before', description: 'Get notified the day before renewal' },
  { value: '3' as ReminderTiming, label: '3 days before', description: 'Get notified 3 days before renewal' },
  { value: '7' as ReminderTiming, label: '7 days before', description: 'Get notified a week before renewal' },
];

const REPORT_OPTIONS = [
  { value: 'monday' as ReportDay, label: 'Monday', description: 'Start your week with spending insights' },
  { value: 'friday' as ReportDay, label: 'Friday', description: 'Review your week\'s subscription activity' },
];

export default function ReminderSettings() {
  const router = useRouter();
  const [settings, setSettings] = useState<ReminderSettings>({
    renewalTiming: '3',
    reportDay: 'monday',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const savedSettings = await SecureStore.getItemAsync('reminderSettings');
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }
    } catch (error) {
      console.error('Failed to load reminder settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async (newSettings: ReminderSettings) => {
    setIsSaving(true);
    try {
      await SecureStore.setItemAsync('reminderSettings', JSON.stringify(newSettings));
      
      // Success haptic feedback
      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Failed to save reminder settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReminderTimingChange = async (timing: ReminderTiming) => {
    if (Platform.OS !== 'web') {
      await Haptics.selectionAsync();
    }
    
    const newSettings = { ...settings, renewalTiming: timing };
    setSettings(newSettings);
    await saveSettings(newSettings);
  };

  const handleReportDayChange = async (day: ReportDay) => {
    if (Platform.OS !== 'web') {
      await Haptics.selectionAsync();
    }
    
    const newSettings = { ...settings, reportDay: day };
    setSettings(newSettings);
    await saveSettings(newSettings);
  };

  const SegmentedControl = ({ 
    options, 
    selectedValue, 
    onValueChange 
  }: { 
    options: typeof REMINDER_OPTIONS; 
    selectedValue: string; 
    onValueChange: (value: ReminderTiming) => void;
  }) => (
    <View style={styles.segmentedContainer}>
      {options.map((option, index) => (
        <TouchableOpacity
          key={option.value}
          style={[
            styles.segmentedButton,
            index === 0 && styles.segmentedButtonFirst,
            index === options.length - 1 && styles.segmentedButtonLast,
            selectedValue === option.value && styles.segmentedButtonActive,
          ]}
          onPress={() => onValueChange(option.value)}
        >
          <Text style={[
            styles.segmentedButtonText,
            selectedValue === option.value && styles.segmentedButtonTextActive,
          ]}>
            {option.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const RadioGroup = ({ 
    options, 
    selectedValue, 
    onValueChange 
  }: { 
    options: typeof REPORT_OPTIONS; 
    selectedValue: string; 
    onValueChange: (value: ReportDay) => void;
  }) => (
    <View style={styles.radioGroup}>
      {options.map((option) => (
        <TouchableOpacity
          key={option.value}
          style={styles.radioOption}
          onPress={() => onValueChange(option.value)}
        >
          <View style={styles.radioContent}>
            <View style={styles.radioCircle}>
              {selectedValue === option.value && (
                <View style={styles.radioSelected} />
              )}
            </View>
            <View style={styles.radioText}>
              <Text style={styles.radioLabel}>{option.label}</Text>
              <Text style={styles.radioDescription}>{option.description}</Text>
            </View>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          testID="back-button"
          onPress={() => router.back()}
        >
          <ChevronLeft size={24} color="#64748B" />
        </TouchableOpacity>
        <Text style={styles.title}>Reminder Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Renewal Notifications Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconContainer}>
              <Bell size={20} color="#3B82F6" />
            </View>
            <View style={styles.sectionTitleContainer}>
              <Text style={styles.sectionTitle}>Renewal Notifications</Text>
              <Text style={styles.sectionDescription}>
                Choose when to receive notifications before your subscriptions renew
              </Text>
            </View>
          </View>

          <View style={styles.sectionContent}>
            <Text style={styles.optionLabel}>Notification Timing</Text>
            <SegmentedControl
              options={REMINDER_OPTIONS}
              selectedValue={settings.renewalTiming}
              onValueChange={handleReminderTimingChange}
            />
            <Text style={styles.optionDescription}>
              {REMINDER_OPTIONS.find(opt => opt.value === settings.renewalTiming)?.description}
            </Text>
          </View>
        </View>

        {/* Weekly Reports Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconContainer}>
              <Mail size={20} color="#10B981" />
            </View>
            <View style={styles.sectionTitleContainer}>
              <Text style={styles.sectionTitle}>Weekly Reports</Text>
              <Text style={styles.sectionDescription}>
                Get a summary of your subscription activity and spending
              </Text>
            </View>
          </View>

          <View style={styles.sectionContent}>
            <Text style={styles.optionLabel}>Report Day</Text>
            <RadioGroup
              options={REPORT_OPTIONS}
              selectedValue={settings.reportDay}
              onValueChange={handleReportDayChange}
            />
          </View>
        </View>

        {/* Additional Info Section */}
        <View style={styles.infoSection}>
          <View style={styles.infoHeader}>
            <Calendar size={16} color="#64748B" />
            <Text style={styles.infoTitle}>How it works</Text>
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.infoText}>
              • Renewal notifications are sent at 9:00 AM in your local timezone
            </Text>
            <Text style={styles.infoText}>
              • Weekly reports include spending trends and upcoming renewals
            </Text>
            <Text style={styles.infoText}>
              • You can temporarily disable notifications in your device settings
            </Text>
          </View>
        </View>

        {isSaving && (
          <View style={styles.savingIndicator}>
            <Text style={styles.savingText}>Saving preferences...</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backButton: {
    padding: SPACING.sm,
  },
  title: {
    ...TYPOGRAPHY.pageTitle,
    fontSize: 20,
    color: TEXT_COLORS.primary,
  },
  headerSpacer: {
    width: 40,
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
    ...TYPOGRAPHY.bodyMedium,
    color: TEXT_COLORS.muted,
  },
  section: {
    backgroundColor: '#ffffff',
    marginBottom: SPACING.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
  },
  sectionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.lg,
  },
  sectionTitleContainer: {
    flex: 1,
  },
  sectionTitle: {
    ...TYPOGRAPHY.cardHeader,
    color: TEXT_COLORS.primary,
    marginBottom: SPACING.xs,
  },
  sectionDescription: {
    ...TYPOGRAPHY.small,
    color: TEXT_COLORS.muted,
    lineHeight: 18,
  },
  sectionContent: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.xl,
  },
  optionLabel: {
    ...TYPOGRAPHY.label,
    color: TEXT_COLORS.primary,
    marginBottom: SPACING.md,
  },
  optionDescription: {
    ...TYPOGRAPHY.caption,
    color: TEXT_COLORS.muted,
    marginTop: SPACING.md,
    fontStyle: 'italic',
  },
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 2,
  },
  segmentedButton: {
    flex: 1,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  segmentedButtonFirst: {
    borderTopLeftRadius: 6,
    borderBottomLeftRadius: 6,
  },
  segmentedButtonLast: {
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
  },
  segmentedButtonActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentedButtonText: {
    ...TYPOGRAPHY.caption,
    color: TEXT_COLORS.muted,
    textAlign: 'center',
  },
  segmentedButtonTextActive: {
    color: TEXT_COLORS.primary,
    fontFamily: 'Inter-SemiBold',
  },
  radioGroup: {
    gap: SPACING.md,
  },
  radioOption: {
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  radioContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.lg,
  },
  radioSelected: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3B82F6',
  },
  radioText: {
    flex: 1,
  },
  radioLabel: {
    ...TYPOGRAPHY.bodyMedium,
    fontFamily: 'Inter-SemiBold',
    color: TEXT_COLORS.primary,
    marginBottom: 2,
  },
  radioDescription: {
    ...TYPOGRAPHY.small,
    color: TEXT_COLORS.muted,
  },
  infoSection: {
    backgroundColor: '#ffffff',
    margin: SPACING.xl,
    borderRadius: 12,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  infoTitle: {
    ...TYPOGRAPHY.label,
    color: TEXT_COLORS.primary,
    marginLeft: SPACING.sm,
  },
  infoContent: {
    gap: SPACING.sm,
  },
  infoText: {
    ...TYPOGRAPHY.small,
    color: TEXT_COLORS.muted,
    lineHeight: 18,
  },
  savingIndicator: {
    backgroundColor: '#EFF6FF',
    margin: SPACING.xl,
    padding: SPACING.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  savingText: {
    ...TYPOGRAPHY.caption,
    color: '#3B82F6',
  },
});