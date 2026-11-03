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
!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="bc8f83a2-f3b2-5e99-b83b-6d1640da3f1c")}catch(e){}}();
//# debugId=bc8f83a2-f3b2-5e99-b83b-6d1640da3f1c
