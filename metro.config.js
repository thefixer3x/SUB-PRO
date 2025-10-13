const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Exclude API routes and server-only files from React Native bundles
config.resolver.blockList = [
  /app\/api\/.*/,
  /services\/stripe-server\.ts$/,
];

// Don't try to resolve Node.js modules in React Native
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];

config.resolver.sourceExts = [...config.resolver.sourceExts, 'jsx', 'js', 'ts', 'tsx'];

module.exports = config;