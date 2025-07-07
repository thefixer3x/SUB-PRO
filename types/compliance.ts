export interface SecurityHealthCheck {
  id: string;
  userId: string;
  score: number; // 0-100
  lastRunAt: Date;
  findings: SecurityFinding[];
  status: 'healthy' | 'warning' | 'critical';
  nextScheduledRun: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SecurityFinding {
  id: string;
  type: 'expired_card' | 'data_breach' | 'weak_auth' | 'outdated_permissions' | 'suspicious_activity';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  recommendation: string;
  affectedResource?: string;
  resolvedAt?: Date;
  createdAt: Date;
}

export interface DataExportRequest {
  id: string;
  userId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'expired';
  exportType: 'full' | 'subscriptions' | 'analytics' | 'payments';
  downloadUrl?: string;
  expiresAt: Date;
  requestedAt: Date;
  completedAt?: Date;
  fileSize?: number;
}

export interface DataDeletionRequest {
  id: string;
  userId: string;
  status: 'pending' | 'confirmed' | 'processing' | 'completed' | 'canceled';
  confirmationToken: string;
  confirmationExpiresAt: Date;
  scheduledDeletionAt?: Date;
  requestedAt: Date;
  completedAt?: Date;
  retentionPeriod: number; // days
}

export interface AuditEvent {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  ipAddress: string;
  userAgent: string;
  metadata?: Record<string, any>;
  timestamp: Date;
  severity: 'info' | 'warning' | 'error';
  category: 'auth' | 'data_access' | 'data_export' | 'data_deletion' | 'payment' | 'subscription';
}

export interface ComplianceConfig {
  securityChecks: {
    enabled: boolean;
    frequency: 'daily' | 'weekly';
    scoreThreshold: number;
    haveIBeenPwnedApiKey?: string;
  };
  dataRetention: {
    auditLogsRetentionDays: number;
    deletedUserRetentionDays: number;
    exportLinkExpirationHours: number;
  };
  notifications: {
    securityAlerts: boolean;
    complianceEmails: boolean;
    auditReports: boolean;
  };
}