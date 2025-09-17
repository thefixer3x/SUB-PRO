import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, Switch } from 'react-native';
import { Bell, Shield, Palette, Download, HelpCircle, ChevronRight, Smartphone, Mail, Calendar, DollarSign, Settings as SettingsIcon, FileText, AlertTriangle } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
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

export default function Settings() {
  const router = useRouter();
  const { colors } = useTheme();
  const { enabled: budgetEnabled, budgetLimit, setBudgetEnabled, setBudgetLimit } = useBudgetAlert();
  const [securityHealthCheck, setSecurityHealthCheck] = useState<SecurityHealthCheck | null>(null);
  const [showSecurityDashboard, setShowSecurityDashboard] = useState(false);
  const [showPrivacyCenter, setShowPrivacyCenter] = useState(false);
  
  const [notifications, setNotifications] = useState({
    renewals: true,
    newSubscriptions: true,
    weeklyReports: true,
  });

  const [preferences, setPreferences] = useState({
    darkMode: false,
    currency: 'USD',
    language: 'English',
  });

  // Mock user data - in production, get from auth context
  const userId = 'user-123';
  const userEmail = 'user@example.com';

  useEffect(() => {
    loadSecurityData();
  }, []);

  const loadSecurityData = async () => {
    if (FEATURE_FLAGS.SECURITY_MONITORING) {
      const healthCheck = await securityMonitoringService.getLatestHealthCheck(userId);
      setSecurityHealthCheck(healthCheck);
    }
  };

  const toggleNotification = (key: keyof typeof notifications) => {
    setNotifications(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

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
    rightElement 
  }: { 
    icon: React.ReactNode; 
    title: string; 
    subtitle?: string; 
    onPress?: () => void;
    rightElement?: React.ReactNode;
  }) => (
    <TouchableOpacity style={[styles.settingsItem, { backgroundColor: colors.card, borderBottomColor: colors.borderLight }]} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.settingsItemLeft}>
        <View style={[styles.iconContainer, { backgroundColor: colors.backgroundSecondary }]}>
          {icon}
        </View>
        <View style={styles.settingsItemText}>
          <Text style={[styles.settingsItemTitle, { color: colors.text }]}>{title}</Text>
          {subtitle && <Text style={[styles.settingsItemSubtitle, { color: colors.textMuted }]}>{subtitle}</Text>}
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

  // Show security banner if there are issues
  const shouldShowSecurityBanner = securityHealthCheck && securityHealthCheck.status !== 'healthy';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Settings</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>Customize your subscription management experience</Text>
        </View>

        {shouldShowSecurityBanner && (
          <SecurityHealthBanner userId={userId} onPress={() => setShowSecurityDashboard(true)} />
        )}

        <ThemeSelector />

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
            currency="USD"
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
            subtitle="USD - US Dollar"
            onPress={() => {}}
          />
          <SettingsItem
            icon={<Calendar size={20} color="#F59E0B" />}
            title="Date Format"
            subtitle="MM/DD/YYYY"
            onPress={() => {}}
          />
        </SettingsSection>

        <SettingsSection title="Data & Privacy">
          <SettingsItem
            icon={<Shield size={20} color="#EF4444" />}
            title="Privacy Settings"
            subtitle="Manage your data and privacy"
            onPress={() => {}}
          />
          <SettingsItem
            icon={<Download size={20} color="#3B82F6" />}
            title="Export Data"
            subtitle="Download your subscription data"
            onPress={() => {}}
          />
        </SettingsSection>

        <SettingsSection title="Support">
          <SettingsItem
            icon={<HelpCircle size={20} color="#64748B" />}
            title="Help & Support"
            subtitle="Get help with the app"
            onPress={() => {}}
          />
        </SettingsSection>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.textMuted }]}>Version 1.0.0</Text>
          <Text style={[styles.footerSubtext, { color: colors.textMuted }]}>Built with ❤️ for subscription management</Text>
          
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