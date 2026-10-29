import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import * as Sentry from '@sentry/react-native';
import type { Integration } from '@sentry/core';
import { Platform } from 'react-native';

const rawDsn =
  process.env.EXPO_PUBLIC_SENTRY_DSN ??
  process.env.NEXT_PUBLIC_SENTRY_DSN ??
  '';

const sentryDsn = rawDsn.trim();

const debugEnabled =
  process.env.EXPO_PUBLIC_SENTRY_DEBUG === 'true' ||
  process.env.NEXT_PUBLIC_SENTRY_DEBUG === 'true';

const runtimeEnvironment =
  process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT ??
  process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ??
  process.env.NODE_ENV ??
  (__DEV__ ? 'development' : 'production');

function readBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) {
    return fallback;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return fallback;
}

function readSampleRate(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(parsed, 0), 1);
}

let hasInitialized = false;

function buildRelease(): string | undefined {
  const configuredRelease =
    process.env.EXPO_PUBLIC_SENTRY_RELEASE ??
    process.env.NEXT_PUBLIC_SENTRY_RELEASE;

  if (configuredRelease?.trim()) {
    return configuredRelease.trim();
  }

  const appConfig = Constants.expoConfig;
  const appId =
    appConfig?.ios?.bundleIdentifier ??
    appConfig?.android?.package ??
    appConfig?.slug;
  const version = appConfig?.version;
  const runtimeVersion =
    typeof Updates.runtimeVersion === 'string' ? Updates.runtimeVersion : undefined;

  if (!appId || !version) {
    return undefined;
  }

  return runtimeVersion
    ? `${appId}@${version}+${runtimeVersion}`
    : `${appId}@${version}`;
}

function buildUpdateDebugUrl(updateGroup: string): string | undefined {
  const manifest = Updates.manifest;
  const extra =
    manifest && typeof manifest === 'object' && 'extra' in manifest
      ? (manifest.extra as { expoClient?: { owner?: string; slug?: string } })
      : undefined;
  const owner = extra?.expoClient?.owner;
  const slug = extra?.expoClient?.slug;

  if (!owner || !slug) {
    return undefined;
  }

  return `https://expo.dev/accounts/${owner}/projects/${slug}/updates/${updateGroup}`;
}

function applyExpoUpdateContext(): void {
  const manifest = Updates.manifest;
  const metadata =
    manifest && typeof manifest === 'object' && 'metadata' in manifest
      ? (manifest.metadata as { updateGroup?: unknown })
      : undefined;
  const updateGroup =
    typeof metadata?.updateGroup === 'string' ? metadata.updateGroup : undefined;
  const updateId = Updates.updateId ?? undefined;

  if (updateId) {
    Sentry.setTag('expo-update-id', updateId);
  }

  Sentry.setTag('expo-is-embedded-update', String(Updates.isEmbeddedLaunch));

  if (typeof Updates.runtimeVersion === 'string') {
    Sentry.setTag('expo-runtime-version', Updates.runtimeVersion);
  }

  if (typeof Updates.channel === 'string') {
    Sentry.setTag('expo-channel', Updates.channel);
  }

  if (updateGroup) {
    Sentry.setTag('expo-update-group-id', updateGroup);

    const debugUrl = buildUpdateDebugUrl(updateGroup);
    if (debugUrl) {
      Sentry.setTag('expo-update-debug-url', debugUrl);
    }
  } else if (Updates.isEmbeddedLaunch) {
    Sentry.setTag('expo-update-debug-url', 'embedded-update');
  }

  Sentry.setContext('expo-update', {
    channel: Updates.channel ?? undefined,
    isEmbeddedLaunch: Updates.isEmbeddedLaunch,
    runtimeVersion: Updates.runtimeVersion ?? undefined,
    updateGroup: updateGroup ?? undefined,
    updateId,
  });
}

function buildIntegrations(replayEnabled: boolean) {
  const integrations: Integration[] = [Sentry.reactNativeTracingIntegration()];

  if (!replayEnabled || Platform.OS === 'web') {
    return integrations;
  }

  integrations.push(
    Sentry.mobileReplayIntegration({
      maskAllImages: true,
      maskAllText: true,
      maskAllVectors: true,
    })
  );

  return integrations;
}

export function initSentry(): boolean {
  if (hasInitialized || !sentryDsn) {
    return false;
  }

  const tracesSampleRate = readSampleRate(
    process.env.EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ??
      process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
    __DEV__ ? 1 : 0.2
  );
  const replaysSessionSampleRate = readSampleRate(
    process.env.EXPO_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE ??
      process.env.NEXT_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE,
    __DEV__ ? 0.25 : 0
  );
  const replaysOnErrorSampleRate = readSampleRate(
    process.env.EXPO_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE ??
      process.env.NEXT_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE,
    1
  );
  const replayEnabled =
    replaysSessionSampleRate > 0 || replaysOnErrorSampleRate > 0;

  Sentry.init({
    dsn: sentryDsn,
    attachStacktrace: true,
    enabled: readBoolean(
      process.env.EXPO_PUBLIC_SENTRY_ENABLED ??
        process.env.NEXT_PUBLIC_SENTRY_ENABLED,
      !__DEV__ || debugEnabled
    ),
    debug: debugEnabled,
    enableLogs: readBoolean(
      process.env.EXPO_PUBLIC_SENTRY_ENABLE_LOGS ??
        process.env.NEXT_PUBLIC_SENTRY_ENABLE_LOGS,
      false
    ),
    environment: runtimeEnvironment,
    release: buildRelease(),
    replaysOnErrorSampleRate,
    replaysSessionSampleRate,
    sendDefaultPii: false,
    enableCaptureFailedRequests: true,
    integrations: buildIntegrations(replayEnabled),
    tracesSampleRate,
  });

  applyExpoUpdateContext();
  hasInitialized = true;
  return true;
}

export function isSentryEnabled(): boolean {
  return Boolean(sentryDsn);
}

export function captureException(
  error: unknown,
  context?: Record<string, string | number | boolean | null | undefined>
): void {
  if (!hasInitialized) {
    return;
  }

  if (!context) {
    Sentry.captureException(error);
    return;
  }

  Sentry.withScope((scope) => {
    for (const [key, value] of Object.entries(context)) {
      if (value !== undefined) {
        scope.setExtra(key, value);
      }
    }

    Sentry.captureException(error);
  });
}

export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = 'info'
): void {
  if (!hasInitialized) {
    return;
  }

  Sentry.captureMessage(message, level);
}

export function setSentryRoute(route: string): void {
  const integration = Sentry.getCurrentReactNativeTracingIntegration();
  integration?.setCurrentRoute(route);

  if (hasInitialized) {
    Sentry.setContext('navigation', { route });
  }
}

export { Sentry };
