import { ComplianceConfig } from '@/types/compliance';

export const COMPLIANCE_CONFIG: ComplianceConfig = {
  securityChecks: {
    enabled: true,
    frequency: 'daily',
    scoreThreshold: 60, // Show warning below this score
    haveIBeenPwnedApiKey: process.env.HAVEIBEENPWNED_API_KEY,
  },
  dataRetention: {
    auditLogsRetentionDays: 365, // 1 year
    deletedUserRetentionDays: 30, // 30 days before permanent deletion
    exportLinkExpirationHours: 24, // 24 hours
  },
  notifications: {
    securityAlerts: true,
    complianceEmails: true,
    auditReports: true,
  },
};

export const FEATURE_FLAGS = {
  COMPLIANCE_CENTER: process.env.EXPO_PUBLIC_COMPLIANCE_CENTER === 'true',
  SECURITY_MONITORING: process.env.EXPO_PUBLIC_SECURITY_MONITORING === 'true',
  GDPR_TOOLS: process.env.EXPO_PUBLIC_GDPR_TOOLS === 'true',
  AUDIT_LOGGING: process.env.EXPO_PUBLIC_AUDIT_LOGGING === 'true',
};

// Security check weights for score calculation
export const SECURITY_WEIGHTS = {
  expired_card: 15,
  data_breach: 25,
  weak_auth: 20,
  outdated_permissions: 10,
  suspicious_activity: 30,
};

// Audit event categories and their retention policies
export const AUDIT_CATEGORIES = {
  auth: { retention: 730, severity: 'warning' }, // 2 years
  data_access: { retention: 365, severity: 'info' }, // 1 year
  data_export: { retention: 2555, severity: 'warning' }, // 7 years (compliance)
  data_deletion: { retention: 2555, severity: 'error' }, // 7 years (compliance)
  payment: { retention: 2555, severity: 'warning' }, // 7 years (financial)
  subscription: { retention: 365, severity: 'info' }, // 1 year
};