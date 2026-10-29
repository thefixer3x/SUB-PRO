const { getSentryExpoConfig } = require('@sentry/react-native/metro');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getSentryExpoConfig(__dirname, {
  includeWebReplay: false,
});

// Exclude API routes and server-only files from React Native bundles
config.resolver.blockList = [
  /app\/api\/.*/,
  /services\/stripe-server\.ts$/,
];

// Don't try to resolve Node.js modules in React Native
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];

config.resolver.sourceExts = [...config.resolver.sourceExts, 'jsx', 'js', 'ts', 'tsx'];

module.exports = config;