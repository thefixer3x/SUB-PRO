#!/usr/bin/env node

// Uploads web source maps to Sentry after `expo export`.
//
// Source maps only improve Sentry stack traces; they are never needed for the app
// to work. So by default a missing, expired or rejected SENTRY_AUTH_TOKEN logs a
// warning and the build still succeeds. Set SENTRY_UPLOAD_STRICT=1 to make an
// upload failure fail the build instead.

const { spawnSync } = require('child_process');

const outputDir = process.argv[2] || 'dist';
const strict = process.env.SENTRY_UPLOAD_STRICT === '1';

const finish = (message) => {
  if (strict) {
    console.error(`[sentry] ${message} (SENTRY_UPLOAD_STRICT=1, failing the build)`);
    process.exit(1);
  }
  console.warn(`[sentry] WARNING: ${message} The build continues without source maps.`);
  process.exit(0);
};

if (!process.env.SENTRY_AUTH_TOKEN) {
  console.log(`[sentry] Skipping sourcemap upload for ${outputDir}; missing SENTRY_AUTH_TOKEN.`);
  process.exit(0);
}

const result = spawnSync('npx', ['sentry-expo-upload-sourcemaps', outputDir], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: process.env,
});

if (result.error) {
  finish(`Sourcemap upload failed to start: ${result.error.message}.`);
}

if (result.status !== 0) {
  finish(
    `Sourcemap upload exited with status ${result.status}. ` +
      'The usual cause is an expired or revoked SENTRY_AUTH_TOKEN.'
  );
}

process.exit(0);
