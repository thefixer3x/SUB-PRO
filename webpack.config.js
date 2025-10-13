const createExpoWebpackConfigAsync = require('@expo/webpack-config');
const path = require('path');
const webpack = require('webpack');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(
    {
      ...env,
      babel: {
        dangerouslyAddModulePathsToTranspile: ['recharts'],
      },
    },
    argv
  );

  // Add web compatibility aliases
  config.resolve.alias = {
    ...config.resolve.alias,
    '@react-native-async-storage/async-storage': require.resolve('./utils/webAsyncStorage.js'),
  };

  // Add web-compatible alias for expo-secure-store
  config.resolve = config.resolve || {};
  config.resolve.alias = {
    ...config.resolve.alias,
    'expo-secure-store': require.resolve('./utils/webSecureStore.js'),
  };

  // Define environment variables for the web build
  config.plugins.push(
    new webpack.DefinePlugin({
      'process.env.EXPO_PUBLIC_SUPABASE_URL': JSON.stringify(process.env.EXPO_PUBLIC_SUPABASE_URL || ''),
      'process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY': JSON.stringify(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ''),
      'process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY': JSON.stringify(process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''),
    })
  );

  // Fix for the "Cannot read properties of undefined (reading 'default')" error
  // This is a common issue with Expo Router and React Native Web
  config.resolve.fallback = {
    ...config.resolve.fallback,
    crypto: false,
    stream: false,
    buffer: false,
    util: false,
    path: false,
    fs: false,
    zlib: false,
  };

  // Production optimizations
  if (env.mode === 'production') {
    // Configure Terser for better minification
    config.optimization.minimizer = config.optimization.minimizer.map((minimizer) => {
      if (minimizer.constructor.name === 'TerserPlugin') {
        minimizer.options.terserOptions = {
          ...minimizer.options.terserOptions,
          compress: {
            drop_console: true,
            drop_debugger: true,
            pure_funcs: ['console.log', 'console.info', 'console.debug'],
          },
          mangle: {
            safari10: true,
          },
        };
      }
      return minimizer;
    });

    // Split chunks for better caching
    config.optimization.splitChunks = {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          priority: 10,
          reuseExistingChunk: true,
        },
        recharts: {
          test: /[\\/]node_modules[\\/]recharts[\\/]/,
          name: 'recharts',
          priority: 20,
          reuseExistingChunk: true,
        },
        common: {
          name: 'common',
          minChunks: 2,
          priority: 5,
          reuseExistingChunk: true,
        },
      },
    };

    // Add bundle analyzer in analyze mode
    if (process.env.ANALYZE === 'true') {
      const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'static',
          openAnalyzer: false,
          reportFilename: path.resolve(__dirname, 'bundle-report.html'),
        })
      );
    }
  }

  // Add performance hints
  config.performance = {
    maxAssetSize: 500000, // 500KB (increased for better compatibility)
    maxEntrypointSize: 500000, // 500KB (increased for better compatibility)
    hints: env.mode === 'production' ? 'warning' : false,
  };

  return config;
};