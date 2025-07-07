declare global {
  namespace NodeJS {
    interface ProcessEnv {
      EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY: string;
      STRIPE_SECRET_KEY: string;
      STRIPE_WEBHOOK_SECRET: string;
      EXPO_PUBLIC_ADMOB_APP_ID: string;
      EXPO_PUBLIC_ADSENSE_PUBLISHER_ID: string;
    }
  }
}

// Ensure this file is treated as a module
export {};