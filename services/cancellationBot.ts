import { CancellationRequest } from '@/types/embeddedFinance';
import { EMBEDDED_FINANCE_CONFIG, VENDOR_CONFIGS } from '@/config/embeddedFinance';

export interface CancellationParams {
  subscriptionId: string;
  userId: string;
  vendorUrl: string;
  userCredentials?: {
    email: string;
    password: string;
  };
}

class CancellationBotService {
  private config = EMBEDDED_FINANCE_CONFIG.automation;

  async requestCancellation(params: CancellationParams): Promise<CancellationRequest> {
    try {
      const vendorDomain = this.extractDomain(params.vendorUrl);
      
      if (!this.isVendorSupported(vendorDomain)) {
        throw new Error(`Automated cancellation not supported for ${vendorDomain}`);
      }

      const response = await fetch('/api/embedded-finance/cancellation/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        throw new Error('Failed to submit cancellation request');
      }

      return await response.json();
    } catch (error) {
      console.error('Cancellation request failed:', error);
      throw error;
    }
  }

  async getCancellationStatus(requestId: string): Promise<CancellationRequest> {
    const response = await fetch(`/api/embedded-finance/cancellation/${requestId}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch cancellation status');
    }

    return await response.json();
  }

  async retryCancellation(requestId: string): Promise<CancellationRequest> {
    const response = await fetch(`/api/embedded-finance/cancellation/${requestId}/retry`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error('Failed to retry cancellation');
    }

    return await response.json();
  }

  async getUserCancellations(userId: string): Promise<CancellationRequest[]> {
    const response = await fetch(`/api/embedded-finance/cancellation/user/${userId}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch user cancellations');
    }

    return await response.json();
  }

  private extractDomain(url: string): string {
    try {
      const domain = new URL(url).hostname;
      return domain.replace('www.', '');
    } catch (error) {
      throw new Error('Invalid URL provided');
    }
  }

  private isVendorSupported(domain: string): boolean {
    return this.config.supportedVendors.includes(domain) || 
           Object.keys(VENDOR_CONFIGS).includes(domain);
  }

  getSupportedVendors(): string[] {
    return this.config.supportedVendors;
  }

  getVendorConfig(domain: string) {
    return VENDOR_CONFIGS[domain as keyof typeof VENDOR_CONFIGS];
  }

  // Check if cancellation is possible for a given vendor
  async checkCancellationSupport(vendorUrl: string): Promise<{
    supported: boolean;
    requiresCredentials: boolean;
    estimatedTime: string;
  }> {
    const domain = this.extractDomain(vendorUrl);
    const isSupported = this.isVendorSupported(domain);
    
    return {
      supported: isSupported,
      requiresCredentials: isSupported,
      estimatedTime: isSupported ? '5-15 minutes' : 'Not available',
    };
  }
}

export const cancellationBotService = new CancellationBotService();