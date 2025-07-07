import { AuditEvent } from '@/types/compliance';
import { AUDIT_CATEGORIES } from '@/config/compliance';

class AuditLoggingService {
  async logEvent(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<void> {
    try {
      const auditEvent: AuditEvent = {
        id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
        ...event,
      };

      await fetch('/api/compliance/audit/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(auditEvent),
      });
    } catch (error) {
      console.error('Failed to log audit event:', error);
      // Don't throw error to avoid breaking app functionality
    }
  }

  async getAuditEvents(userId: string, filters?: {
    category?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<AuditEvent[]> {
    try {
      const params = new URLSearchParams();
      params.set('userId', userId);
      
      if (filters?.category) params.set('category', filters.category);
      if (filters?.startDate) params.set('startDate', filters.startDate.toISOString());
      if (filters?.endDate) params.set('endDate', filters.endDate.toISOString());
      if (filters?.limit) params.set('limit', filters.limit.toString());

      const response = await fetch(`/api/compliance/audit/events?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to get audit events');
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get audit events:', error);
      throw error;
    }
  }

  // Convenience methods for common audit events
  async logDataAccess(userId: string, resource: string, resourceId?: string, metadata?: any): Promise<void> {
    await this.logEvent({
      userId,
      action: 'data_access',
      resource,
      resourceId,
      ipAddress: await this.getClientIP(),
      userAgent: navigator.userAgent,
      metadata,
      severity: 'info',
      category: 'data_access',
    });
  }

  async logDataExport(userId: string, exportType: string, metadata?: any): Promise<void> {
    await this.logEvent({
      userId,
      action: 'data_export_requested',
      resource: 'user_data',
      ipAddress: await this.getClientIP(),
      userAgent: navigator.userAgent,
      metadata: { exportType, ...metadata },
      severity: 'warning',
      category: 'data_export',
    });
  }

  async logDataDeletion(userId: string, action: string, metadata?: any): Promise<void> {
    await this.logEvent({
      userId,
      action,
      resource: 'user_account',
      ipAddress: await this.getClientIP(),
      userAgent: navigator.userAgent,
      metadata,
      severity: 'error',
      category: 'data_deletion',
    });
  }

  async logAuthentication(userId: string, action: string, success: boolean, metadata?: any): Promise<void> {
    await this.logEvent({
      userId,
      action,
      resource: 'user_session',
      ipAddress: await this.getClientIP(),
      userAgent: navigator.userAgent,
      metadata: { success, ...metadata },
      severity: success ? 'info' : 'warning',
      category: 'auth',
    });
  }

  async logPaymentActivity(userId: string, action: string, resourceId: string, metadata?: any): Promise<void> {
    await this.logEvent({
      userId,
      action,
      resource: 'payment',
      resourceId,
      ipAddress: await this.getClientIP(),
      userAgent: navigator.userAgent,
      metadata,
      severity: 'warning',
      category: 'payment',
    });
  }

  async logSubscriptionActivity(userId: string, action: string, subscriptionId: string, metadata?: any): Promise<void> {
    await this.logEvent({
      userId,
      action,
      resource: 'subscription',
      resourceId: subscriptionId,
      ipAddress: await this.getClientIP(),
      userAgent: navigator.userAgent,
      metadata,
      severity: 'info',
      category: 'subscription',
    });
  }

  private async getClientIP(): Promise<string> {
    try {
      // In production, you might want to use a service to get the real IP
      // For now, return a placeholder
      return 'client-ip';
    } catch {
      return 'unknown';
    }
  }

  async cleanupOldLogs(): Promise<void> {
    try {
      await fetch('/api/compliance/audit/cleanup', {
        method: 'POST',
      });
    } catch (error) {
      console.error('Failed to cleanup old audit logs:', error);
    }
  }
}

export const auditLoggingService = new AuditLoggingService();