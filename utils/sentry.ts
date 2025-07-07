// Sentry integration for error tracking and performance monitoring
import { Platform } from 'react-native';

interface SentryConfig {
  dsn?: string;
  debug?: boolean;
  environment?: string;
}

let Sentry: any = null;

// Platform-specific Sentry initialization
const initializeSentry = () => {
  if (Platform.OS === 'web') {
    // Web platform - use @sentry/react
    try {
      Sentry = require('@sentry/react');
    } catch (error) {
      console.warn('Sentry web SDK not installed. Install @sentry/react for web error tracking.');
      return null;
    }
  } else {
    // Mobile platforms - use @sentry/react-native
    try {
      Sentry = require('@sentry/react-native');
    } catch (error) {
      console.warn('Sentry mobile SDK not installed. Install @sentry/react-native for mobile error tracking.');
      return null;
    }
  }
  
  return Sentry;
};

export const initSentry = (config?: SentryConfig) => {
  // Only initialize in production or when explicitly enabled
  if (__DEV__ && !config?.debug) {
    console.log('Sentry disabled in development mode');
    return;
  }

  const SentrySDK = initializeSentry();
  
  if (!SentrySDK) {
    return;
  }

  try {
    SentrySDK.init({
      dsn: config?.dsn || process.env.EXPO_PUBLIC_SENTRY_DSN,
      debug: config?.debug || __DEV__,
      environment: config?.environment || (__DEV__ ? 'development' : 'production'),
      tracesSampleRate: 1.0,
      enableAutoSessionTracking: true,
      sessionTrackingIntervalMillis: 10000,
      beforeSend(event: any) {
        // Filter out development errors or add custom logic
        if (__DEV__) {
          console.log('Sentry event:', event);
        }
        return event;
      },
    });

    console.log('Sentry initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Sentry:', error);
  }
};

export const captureException = (error: Error, context?: Record<string, any>) => {
  if (Sentry) {
    if (context) {
      Sentry.withScope((scope: any) => {
        Object.keys(context).forEach(key => {
          scope.setTag(key, context[key]);
        });
        Sentry.captureException(error);
      });
    } else {
      Sentry.captureException(error);
    }
  } else {
    console.error('Sentry not initialized:', error);
  }
};

export const captureMessage = (message: string, level: 'info' | 'warning' | 'error' = 'info') => {
  if (Sentry) {
    Sentry.captureMessage(message, level);
  } else {
    console.log(`Sentry message [${level}]:`, message);
  }
};

export { Sentry };