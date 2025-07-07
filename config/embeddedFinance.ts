import { EmbeddedFinanceConfig } from '@/types/embeddedFinance';

export const EMBEDDED_FINANCE_CONFIG: EmbeddedFinanceConfig = {
  virtualCards: {
    enabled: true,
    provider: 'stripe', // Switch to 'weavr' for Weavr integration
    defaultSpendingLimit: 1000, // $1000 default limit
    autoCreateForSubscriptions: true,
  },
  creditService: {
    enabled: false, // Coming soon
    provider: 'subtrack_credit',
    defaultCreditLimit: 5000, // $5000 default limit
    autoPayForSubscriptions: false,
    settlementPeriod: 'monthly',
  },
  automation: {
    enabled: true,
    maxAttempts: 3,
    retryDelayMinutes: 60,
    supportedVendors: [
      'netflix.com',
      'spotify.com',
      'adobe.com',
      'github.com',
      'notion.so',
      'figma.com',
      'slack.com',
      'zoom.us',
    ],
  },
  paymentOptimization: {
    enabled: false, // Coming soon
    provider: 'subtrack_optimizer',
    autoSwitchCards: false,
    preventFailures: true,
  },
  affiliates: {
    enabled: true,
    trackingEnabled: true,
    defaultCommission: 0.05, // 5% default commission
  },
};

export const ENCRYPTION_CONFIG = {
  algorithm: 'aes-256-gcm',
  keyDerivation: 'pbkdf2',
  iterations: 100000,
};

// Supported vendors for automated cancellation
export const VENDOR_CONFIGS = {
  'netflix.com': {
    loginUrl: 'https://www.netflix.com/login',
    accountUrl: 'https://www.netflix.com/YourAccount',
    cancelPath: '/cancelplan',
    selectors: {
      email: '#id_userLoginId',
      password: '#id_password',
      loginButton: '.login-button',
      cancelButton: '[data-uia="cancel-membership-button"]',
      confirmButton: '[data-uia="confirm-cancel-button"]',
    },
  },
  'spotify.com': {
    loginUrl: 'https://accounts.spotify.com/en/login',
    accountUrl: 'https://www.spotify.com/account/subscription/',
    cancelPath: '/cancel',
    selectors: {
      email: '#login-username',
      password: '#login-password',
      loginButton: '#login-button',
      cancelButton: '[data-testid="cancel-button"]',
      confirmButton: '[data-testid="confirm-cancel"]',
    },
  },
  // Add more vendor configurations as needed
};