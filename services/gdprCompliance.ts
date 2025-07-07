import { DataExportRequest, DataDeletionRequest } from '@/types/compliance';
import { COMPLIANCE_CONFIG } from '@/config/compliance';

class GDPRComplianceService {
  private config = COMPLIANCE_CONFIG;

  async requestDataExport(userId: string, exportType: 'full' | 'subscriptions' | 'analytics' | 'payments' = 'full'): Promise<DataExportRequest> {
    try {
      const response = await fetch('/api/compliance/gdpr/export-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, exportType }),
      });

      if (!response.ok) {
        throw new Error('Failed to request data export');
      }

      return await response.json();
    } catch (error) {
      console.error('Data export request failed:', error);
      throw error;
    }
  }

  async getExportStatus(requestId: string): Promise<DataExportRequest> {
    try {
      const response = await fetch(`/api/compliance/gdpr/export-request/${requestId}`);
      
      if (!response.ok) {
        throw new Error('Failed to get export status');
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get export status:', error);
      throw error;
    }
  }

  async getUserExports(userId: string): Promise<DataExportRequest[]> {
    try {
      const response = await fetch(`/api/compliance/gdpr/exports?userId=${userId}`);
      
      if (!response.ok) {
        throw new Error('Failed to get user exports');
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get user exports:', error);
      throw error;
    }
  }

  async requestDataDeletion(userId: string): Promise<DataDeletionRequest> {
    try {
      const response = await fetch('/api/compliance/gdpr/deletion-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        throw new Error('Failed to request data deletion');
      }

      return await response.json();
    } catch (error) {
      console.error('Data deletion request failed:', error);
      throw error;
    }
  }

  async confirmDataDeletion(token: string): Promise<void> {
    try {
      const response = await fetch('/api/compliance/gdpr/confirm-deletion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      if (!response.ok) {
        throw new Error('Failed to confirm data deletion');
      }
    } catch (error) {
      console.error('Data deletion confirmation failed:', error);
      throw error;
    }
  }

  async getDeletionStatus(userId: string): Promise<DataDeletionRequest | null> {
    try {
      const response = await fetch(`/api/compliance/gdpr/deletion-status?userId=${userId}`);
      
      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error('Failed to get deletion status');
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get deletion status:', error);
      throw error;
    }
  }

  async cancelDataDeletion(userId: string): Promise<void> {
    try {
      const response = await fetch('/api/compliance/gdpr/cancel-deletion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        throw new Error('Failed to cancel data deletion');
      }
    } catch (error) {
      console.error('Data deletion cancellation failed:', error);
      throw error;
    }
  }

  // Generate privacy policy and data handling information
  getPrivacyPolicy(): {
    dataCollected: string[];
    dataUsage: string[];
    dataRetention: string[];
    userRights: string[];
  } {
    return {
      dataCollected: [
        'Account information (email, name)',
        'Subscription data and payment history',
        'Usage analytics and preferences',
        'Device and browser information',
        'Virtual card transaction data (encrypted)',
      ],
      dataUsage: [
        'Providing subscription management services',
        'Processing payments and cancellations',
        'Sending notifications and updates',
        'Improving app functionality and user experience',
        'Compliance with legal and regulatory requirements',
      ],
      dataRetention: [
        'Account data: Retained until account deletion',
        'Payment data: 7 years for tax and legal compliance',
        'Analytics data: 2 years for service improvement',
        'Audit logs: 1-7 years depending on event type',
        'Deleted account data: 30 days before permanent removal',
      ],
      userRights: [
        'Right to access your personal data',
        'Right to rectify inaccurate data',
        'Right to erase your data (right to be forgotten)',
        'Right to restrict processing',
        'Right to data portability',
        'Right to object to processing',
        'Right to withdraw consent',
      ],
    };
  }
}

export const gdprComplianceService = new GDPRComplianceService();