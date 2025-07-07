import { SecurityHealthCheck, SecurityFinding } from '@/types/compliance';
import { COMPLIANCE_CONFIG, SECURITY_WEIGHTS } from '@/config/compliance';

export interface SecurityCheckParams {
  userId: string;
  userEmail: string;
  includeBreachCheck?: boolean;
}

class SecurityMonitoringService {
  private config = COMPLIANCE_CONFIG.securityChecks;

  async runSecurityHealthCheck(params: SecurityCheckParams): Promise<SecurityHealthCheck> {
    try {
      const findings: SecurityFinding[] = [];

      // Check for expired virtual cards
      const expiredCardFindings = await this.checkExpiredCards(params.userId);
      findings.push(...expiredCardFindings);

      // Check for data breaches
      if (params.includeBreachCheck && this.config.haveIBeenPwnedApiKey) {
        const breachFindings = await this.checkDataBreaches(params.userEmail);
        findings.push(...breachFindings);
      }

      // Check authentication strength
      const authFindings = await this.checkAuthenticationStrength(params.userId);
      findings.push(...authFindings);

      // Check permissions and access
      const permissionFindings = await this.checkOutdatedPermissions(params.userId);
      findings.push(...permissionFindings);

      // Check for suspicious activity
      const activityFindings = await this.checkSuspiciousActivity(params.userId);
      findings.push(...activityFindings);

      // Calculate security score
      const score = this.calculateSecurityScore(findings);
      const status = this.getSecurityStatus(score);

      const healthCheck: SecurityHealthCheck = {
        id: `health_${Date.now()}`,
        userId: params.userId,
        score,
        lastRunAt: new Date(),
        findings,
        status,
        nextScheduledRun: new Date(Date.now() + 24 * 60 * 60 * 1000), // Next day
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Store health check result
      await this.storeHealthCheck(healthCheck);

      return healthCheck;
    } catch (error) {
      console.error('Security health check failed:', error);
      throw new Error('Failed to run security health check');
    }
  }

  private async checkExpiredCards(userId: string): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];

    try {
      // Check virtual cards expiration
      const response = await fetch(`/api/compliance/security/expired-cards?userId=${userId}`);
      if (response.ok) {
        const expiredCards = await response.json();
        
        expiredCards.forEach((card: any) => {
          findings.push({
            id: `expired_card_${card.id}`,
            type: 'expired_card',
            severity: 'medium',
            title: 'Expired Virtual Card',
            description: `Virtual card ending in ${card.last4} has expired`,
            recommendation: 'Remove or replace the expired card to maintain secure payment processing',
            affectedResource: card.id,
            createdAt: new Date(),
          });
        });
      }
    } catch (error) {
      console.error('Failed to check expired cards:', error);
    }

    return findings;
  }

  private async checkDataBreaches(email: string): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];

    try {
      if (!this.config.haveIBeenPwnedApiKey) return findings;

      const response = await fetch(`https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}`, {
        headers: {
          'hibp-api-key': this.config.haveIBeenPwnedApiKey,
          'User-Agent': 'SubscriptionManager-SecurityCheck',
        },
      });

      if (response.status === 200) {
        const breaches = await response.json();
        
        // Only report recent breaches (within last year)
        const recentBreaches = breaches.filter((breach: any) => {
          const breachDate = new Date(breach.BreachDate);
          const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
          return breachDate > oneYearAgo;
        });

        recentBreaches.forEach((breach: any) => {
          findings.push({
            id: `breach_${breach.Name}`,
            type: 'data_breach',
            severity: 'high',
            title: 'Data Breach Detected',
            description: `Your email was found in the ${breach.Title} data breach`,
            recommendation: 'Change your passwords and enable two-factor authentication',
            affectedResource: breach.Name,
            createdAt: new Date(),
          });
        });
      }
    } catch (error) {
      console.error('Failed to check data breaches:', error);
    }

    return findings;
  }

  private async checkAuthenticationStrength(userId: string): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];

    try {
      // Check if user has 2FA enabled
      const response = await fetch(`/api/compliance/security/auth-strength?userId=${userId}`);
      if (response.ok) {
        const authData = await response.json();
        
        if (!authData.twoFactorEnabled) {
          findings.push({
            id: 'weak_auth_no_2fa',
            type: 'weak_auth',
            severity: 'medium',
            title: 'Two-Factor Authentication Disabled',
            description: 'Your account is not protected by two-factor authentication',
            recommendation: 'Enable 2FA to significantly improve your account security',
            createdAt: new Date(),
          });
        }

        if (authData.passwordAge > 365) {
          findings.push({
            id: 'weak_auth_old_password',
            type: 'weak_auth',
            severity: 'low',
            title: 'Password Not Recently Changed',
            description: 'Your password is over a year old',
            recommendation: 'Consider changing your password regularly for better security',
            createdAt: new Date(),
          });
        }
      }
    } catch (error) {
      console.error('Failed to check authentication strength:', error);
    }

    return findings;
  }

  private async checkOutdatedPermissions(userId: string): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];

    try {
      const response = await fetch(`/api/compliance/security/permissions?userId=${userId}`);
      if (response.ok) {
        const permissionsData = await response.json();
        
        if (permissionsData.unusedIntegrations?.length > 0) {
          findings.push({
            id: 'outdated_permissions',
            type: 'outdated_permissions',
            severity: 'low',
            title: 'Unused Third-Party Integrations',
            description: `You have ${permissionsData.unusedIntegrations.length} unused integrations`,
            recommendation: 'Review and remove unused third-party app permissions',
            createdAt: new Date(),
          });
        }
      }
    } catch (error) {
      console.error('Failed to check permissions:', error);
    }

    return findings;
  }

  private async checkSuspiciousActivity(userId: string): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];

    try {
      const response = await fetch(`/api/compliance/security/suspicious-activity?userId=${userId}`);
      if (response.ok) {
        const activityData = await response.json();
        
        if (activityData.unusualLocations?.length > 0) {
          findings.push({
            id: 'suspicious_activity_location',
            type: 'suspicious_activity',
            severity: 'high',
            title: 'Unusual Login Locations',
            description: 'Recent logins from unfamiliar locations detected',
            recommendation: 'Review recent login activity and secure your account',
            createdAt: new Date(),
          });
        }

        if (activityData.failedLoginAttempts > 10) {
          findings.push({
            id: 'suspicious_activity_failed_logins',
            type: 'suspicious_activity',
            severity: 'medium',
            title: 'Multiple Failed Login Attempts',
            description: `${activityData.failedLoginAttempts} failed login attempts in the last 24 hours`,
            recommendation: 'Change your password and enable account monitoring',
            createdAt: new Date(),
          });
        }
      }
    } catch (error) {
      console.error('Failed to check suspicious activity:', error);
    }

    return findings;
  }

  private calculateSecurityScore(findings: SecurityFinding[]): number {
    let totalDeduction = 0;

    findings.forEach(finding => {
      const weight = SECURITY_WEIGHTS[finding.type] || 10;
      const severityMultiplier = {
        low: 0.3,
        medium: 0.6,
        high: 0.8,
        critical: 1.0,
      }[finding.severity];

      totalDeduction += weight * severityMultiplier;
    });

    const score = Math.max(0, 100 - totalDeduction);
    return Math.round(score);
  }

  private getSecurityStatus(score: number): 'healthy' | 'warning' | 'critical' {
    if (score >= 80) return 'healthy';
    if (score >= this.config.scoreThreshold) return 'warning';
    return 'critical';
  }

  private async storeHealthCheck(healthCheck: SecurityHealthCheck): Promise<void> {
    try {
      await fetch('/api/compliance/security/health-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(healthCheck),
      });
    } catch (error) {
      console.error('Failed to store health check:', error);
    }
  }

  async getLatestHealthCheck(userId: string): Promise<SecurityHealthCheck | null> {
    try {
      const response = await fetch(`/api/compliance/security/health-check?userId=${userId}`);
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error('Failed to get health check:', error);
    }
    return null;
  }

  async resolveSecurityFinding(findingId: string): Promise<void> {
    try {
      await fetch(`/api/compliance/security/findings/${findingId}/resolve`, {
        method: 'POST',
      });
    } catch (error) {
      console.error('Failed to resolve security finding:', error);
      throw error;
    }
  }
}

export const securityMonitoringService = new SecurityMonitoringService();