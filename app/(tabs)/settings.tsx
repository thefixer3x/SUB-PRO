import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Switch,
  Alert,
  Platform,
  Share as RNShare,
  Linking,
} from 'react-native';
import {
  Bell,
  Shield,
  Palette,
  Download,
  ChevronRight,
  Smartphone,
  Mail,
  DollarSign,
  Settings as SettingsIcon,
  FileText,
  AlertTriangle,
  LogOut,
  HelpCircle,
  LayoutGrid,
  ListChecks,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { getSupportLink } from '@/config/support';
import { ThemeSelector } from '@/components/ThemeSelector';
import { BudgetAlertRow } from '@/components/BudgetAlertRow';
import { useBudgetAlert } from '@/hooks/useBudgetAlert';
import { TYPOGRAPHY, SPACING } from '@/constants/Typography';
import { SecurityHealthBanner } from '@/components/compliance/SecurityHealthBanner';
import { SecurityDashboard } from '@/components/compliance/SecurityDashboard';
import { PrivacyCenter } from '@/components/compliance/PrivacyCenter';
import { securityMonitoringService } from '@/services/securityMonitoring';
import { FEATURE_FLAGS } from '@/config/compliance';
import { SecurityHealthCheck } from '@/types/compliance';
import { PoweredByLanOnasis } from '@/components/branding/PoweredByLanOnasis';
import { usePreferences } from '@/hooks/usePreferences';
import { useSubscriptions } from '@/hooks/useSubscriptions';

export default function Settings() {
  const router = useRouter();
  const { colors } = useTheme();
  const { signOut, user } = useAuth();
  const { enabled: budgetEnabled, budgetLimit, setBudgetEnabled, setBudgetLimit } = useBudgetAlert();
  const { preferences, setPreferences } = usePreferences();
  const [securityHealthCheck, setSecurityHealthCheck] = useState<SecurityHealthCheck | null>(null);
  const [showSecurityDashboard, setShowSecurityDashboard] = useState(false);
  const [showPrivacyCenter, setShowPrivacyCenter] = useState(false);

  // Real user from auth context (replaces the old placeholder user ID and email)
  const userId = user?.id ?? '';
  const userEmail = user?.email ?? '';
  const displayName =
    user?.user_metadata?.full_name ?? (userEmail ? userEmail.split('@')[0] : '');

  // Notification toggles live in the persisted preferences, so they survive a reload.
  const notifications = preferences.notifications;
  const [showCurrencyOptions, setShowCurrencyOptions] = useState(false);
  const { data: userSubscriptions, isLoading: subscriptionsLoading } = useSubscriptions(userId || undefined);

  useEffect(() => {
    loadSecurityData();
  }, []);

  const loadSecurityData = async () => {
    if (FEATURE_FLAGS.SECURITY_MONITORING && userId) {
      const healthCheck = await securityMonitoringService.getLatestHealthCheck(userId);
      setSecurityHealthCheck(healthCheck);
    }
  };

  const toggleNotification = (key: keyof typeof notifications) => {
    setPreferences(prev => ({
      ...prev,
      notifications: { ...prev.notifications, [key]: !prev.notifications[key] },
    }));
  };

  // react-native-web has no working Alert.alert, so the confirmation dialog is
  // platform-specific: a native alert on iOS/Android, window.confirm on web.
  const confirmSignOut = async (): Promise<boolean> => {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined' || typeof window.confirm !== 'function') {
        return true;
      }
      return window.confirm('Sign out of your account?');
    }

    return new Promise<boolean>(resolve => {
      Alert.alert(
        'Sign Out',
        'Are you sure you want to sign out?',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Sign Out', style: 'destructive', onPress: () => resolve(true) },
        ],
        { cancelable: true, onDismiss: () => resolve(false) }
      );
    });
  };

  const showMessage = (title: string, message: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.alert === 'function') {
      window.alert(`${title}\n\n${message}`);
      return;
    }
    Alert.alert(title, message);
  };

  const handleSignOut = async () => {
    const confirmed = await confirmSignOut();
    if (!confirmed) {
      return;
    }
    const result = await signOut();
    if (!result.success) {
      showMessage('Sign Out Failed', result.error ?? 'Unable to sign out. Please try again.');
      return;
    }
    router.replace('/(auth)/signin');
  };

  // --- Wired preference handlers (replaces the old no-op onPress) ---

  // An inline list rather than Alert.alert with buttons, which does nothing on
  // react-native-web.
  const CURRENCY_OPTIONS = [
    { code: 'USD', label: 'US Dollar' },
    { code: 'EUR', label: 'Euro' },
    { code: 'GBP', label: 'British Pound' },
    { code: 'NGN', label: 'Nigerian Naira' },
  ];

  const handleCurrencyTap = () => setShowCurrencyOptions(open => !open);

  const selectCurrency = (code: string) => {
    setPreferences(prev => ({ ...prev, currency: code }));
    setShowCurrencyOptions(false);
  };

  const handlePrivacySettingsTap = () => {
    setShowPrivacyCenter(true);
  };

  const handleExportData = async () => {
    if (subscriptionsLoading || !userSubscriptions) {
      showMessage('Export Data', 'Your subscriptions are still loading. Please try again in a moment.');
      return;
    }
    try {
      const exportPayload = {
        user: {
          id: userId,
          email: userEmail,
        },
        preferences,
        subscriptions: userSubscriptions,
        exportedAt: new Date().toISOString(),
      };

      const json = JSON.stringify(exportPayload, null, 2);

      if (Platform.OS === 'web') {
        // Web: trigger a file download
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'subtrack-data.json';
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
      } else {
        // Native: share as JSON
        await RNShare.share({
          title: 'SUB Track Data',
          message: json,
        });
      }
    } catch {
      showMessage('Export Failed', 'Unable to export your data. Please try again.');
    }
  };

  const supportLink = getSupportLink();

  const handleOpenSupport = async () => {
    if (!supportLink) return;
    try {
      await Linking.openURL(supportLink.href);
    } catch {
      Alert.alert('Help & Support', `Could not open ${supportLink.label}.`);
    }
  };

  // --- Render helpers ---

  const SettingsSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );

  const SettingsItem = ({
    icon,
    title,
    subtitle,
    onPress,
    rightElement,
  }: {
    icon: React.ReactNode;
    title: string;
    subtitle?: string;
    onPress?: () => void;
    rightElement?: React.ReactNode;
  }) => (
    <TouchableOpacity
      style={[
        styles.settingsItem,
        { backgroundColor: colors.card, borderBottomColor: colors.borderLight },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.settingsItemLeft}>
        <View style={[styles.iconContainer, { backgroundColor: colors.backgroundSecondary }]}>
          {icon}
        </View>
        <View style={styles.settingsItemText}>
          <Text style={[styles.settingsItemTitle, { color: colors.text }]}>{title}</Text>
          {subtitle && (
            <Text style={[styles.settingsItemSubtitle, { color: colors.textMuted }]}>{subtitle}</Text>
          )}
        </View>
      </View>
      <View style={styles.settingsItemRight}>
        {rightElement || <ChevronRight size={20} color={colors.textMuted} />}
      </View>
    </TouchableOpacity>
  );

  const styles = createStyles(colors);

  if (showSecurityDashboard) {
    return <SecurityDashboard userId={userId} userEmail={userEmail} />;
  }

  if (showPrivacyCenter) {
    return <PrivacyCenter userId={userId} />;
  }

  const shouldShowSecurityBanner = securityHealthCheck && securityHealthCheck.status !== 'healthy';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>
            {displayName ? `Hi, ${displayName}` : 'Settings'}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Customize your subscription management experience
          </Text>
        </View>

        {shouldShowSecurityBanner && (
          <SecurityHealthBanner userId={userId} onPress={() => setShowSecurityDashboard(true)} />
        )}

        <ThemeSelector />

        <SettingsSection title="Explore">
          <SettingsItem
            icon={<LayoutGrid size={20} color="#3B82F6" />}
            title="All features"
            subtitle="What SUB-PRO does today, what Pro unlocks, and what is coming"
            onPress={() => router.push('/(tabs)/features')}
          />
          <SettingsItem
            icon={<ListChecks size={20} color="#10B981" />}
            title="My subscriptions"
            subtitle="Every subscription you track, with add and share"
            onPress={() => router.push('/(tabs)/subscriptions')}
          />
        </SettingsSection>

        <SettingsSection title="Notifications">
          <SettingsItem
            icon={<Bell size={20} color="#3B82F6" />}
            title="Renewal & Report Settings"
            subtitle="Configure notification timing and weekly reports"
            onPress={() => router.push('/reminder-settings')}
          />
          <BudgetAlertRow
            enabled={budgetEnabled}
            onToggle={setBudgetEnabled}
            budgetLimit={budgetLimit}
            onBudgetChange={setBudgetLimit}
            currency={preferences.currency}
          />
          <SettingsItem
            icon={<Smartphone size={20} color="#10B981" />}
            title="New Subscriptions"
            subtitle="Alerts when new subscriptions are added"
            rightElement={
              <Switch
                value={notifications.newSubscriptions}
                onValueChange={() => toggleNotification('newSubscriptions')}
                trackColor={{ false: '#E5E7EB', true: '#3B82F6' }}
                thumbColor="#ffffff"
              />
            }
          />
          <SettingsItem
            icon={<Mail size={20} color="#8B5CF6" />}
            title="Weekly Reports"
            subtitle="Get weekly spending summaries"
            rightElement={
              <Switch
                value={notifications.weeklyReports}
                onValueChange={() => toggleNotification('weeklyReports')}
                trackColor={{ false: '#E5E7EB', true: '#3B82F6' }}
                thumbColor="#ffffff"
              />
            }
          />
        </SettingsSection>

        {FEATURE_FLAGS.COMPLIANCE_CENTER && (
          <SettingsSection title="Security & Privacy">
            <SettingsItem
              icon={<Shield size={20} color="#3B82F6" />}
              title="Security Center"
              subtitle="Monitor account security and get recommendations"
              onPress={() => setShowSecurityDashboard(true)}
              rightElement={
                securityHealthCheck?.status === 'critical' ? (
                  <AlertTriangle size={20} color="#EF4444" />
                ) : (
                  <ChevronRight size={20} color={colors.textMuted} />
                )
              }
            />
            <SettingsItem
              icon={<FileText size={20} color="#10B981" />}
              title="Privacy & Data Control"
              subtitle="Export or delete your data, review privacy policy"
              onPress={() => setShowPrivacyCenter(true)}
            />
          </SettingsSection>
        )}

        <SettingsSection title="Preferences">
          <SettingsItem
            icon={<DollarSign size={20} color="#10B981" />}
            title="Currency"
            subtitle={`${preferences.currency} — Select currency`}
            onPress={handleCurrencyTap}
          />
          {showCurrencyOptions &&
            CURRENCY_OPTIONS.map(option => (
              <SettingsItem
                key={option.code}
                icon={<DollarSign size={20} color={option.code === preferences.currency ? '#10B981' : colors.textMuted} />}
                title={`${option.code} — ${option.label}`}
                subtitle={option.code === preferences.currency ? 'Selected' : undefined}
                onPress={() => selectCurrency(option.code)}
              />
            ))}
        </SettingsSection>

        <SettingsSection title="Data & Privacy">
          <SettingsItem
            icon={<Shield size={20} color="#EF4444" />}
            title="Privacy Settings"
            subtitle="Manage your data and privacy"
            onPress={handlePrivacySettingsTap}
          />
          <SettingsItem
            icon={<Download size={20} color="#3B82F6" />}
            title="Export Data"
            subtitle="Download your subscription data"
            onPress={handleExportData}
          />
        </SettingsSection>

        {supportLink && (
          <SettingsSection title="Support">
            <SettingsItem
              icon={<HelpCircle size={20} color="#3B82F6" />}
              title="Help & Support"
              subtitle={supportLink.kind === 'email' ? `Email ${supportLink.label}` : supportLink.label}
              onPress={handleOpenSupport}
            />
          </SettingsSection>
        )}

        <SettingsSection title="Account">
          <SettingsItem
            icon={<LogOut size={20} color="#EF4444" />}
            title="Sign Out"
            subtitle={user?.email || 'Sign out of your account'}
            onPress={() => {
              void handleSignOut();
            }}
          />
        </SettingsSection>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.textMuted }]}>Version 1.0.0</Text>
          <Text style={[styles.footerSubtext, { color: colors.textMuted }]}>
            Built with ❤️ for subscription management
          </Text>

          <View style={styles.partnerCreditContainer}>
            <PoweredByLanOnasis variant="standard" />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING['2xl'],
  },
  title: {
    ...TYPOGRAPHY.pageTitle,
    fontSize: 32,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    ...TYPOGRAPHY.bodyMedium,
  },
  section: {
    marginBottom: SPACING['3xl'],
  },
  sectionTitle: {
    ...TYPOGRAPHY.sectionHeader,
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.xl,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
  },
  settingsItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.lg,
  },
  settingsItemText: {
    flex: 1,
  },
  settingsItemTitle: {
    ...TYPOGRAPHY.bodyMedium,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 2,
  },
  settingsItemSubtitle: {
    ...TYPOGRAPHY.small,
  },
  settingsItemRight: {
    marginLeft: SPACING.lg,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: SPACING.xl,
  },
  footerText: {
    ...TYPOGRAPHY.small,
    marginBottom: SPACING.xs,
  },
  footerSubtext: {
    ...TYPOGRAPHY.caption,
  },
  partnerCreditContainer: {
    marginTop: SPACING.lg,
    alignItems: 'center',
  },
});
