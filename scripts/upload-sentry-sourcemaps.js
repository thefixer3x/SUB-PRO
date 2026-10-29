#!/usr/bin/env node

const { spawnSync } = require('child_process');

const outputDir = process.argv[2] || 'dist';
const requiredEnv = ['SENTRY_AUTH_TOKEN'];
const missingEnv = requiredEnv.filter((name) => !process.env[name]);

if (missingEnv.length > 0) {
  console.log(
    `[sentry] Skipping sourcemap upload for ${outputDir}; missing ${missingEnv.join(', ')}.`
  );
  process.exit(0);
}

const result = spawnSync('npx', ['sentry-expo-upload-sourcemaps', outputDir], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: process.env,
});

if (result.error) {
  console.error('[sentry] Sourcemap upload failed to start:', result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 0);
