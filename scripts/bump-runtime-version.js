#!/usr/bin/env node

/**
 * Utility script to bump the Expo app version, runtimeVersion, and native build numbers
 * in a single step. This keeps the bare workflow requirements satisfied by ensuring
 * runtimeVersion is a static string while still being easy to increment.
 *
 * Usage:
 *   node scripts/bump-runtime-version.js [patch|minor|major] [--dry-run]
 *
 * The script defaults to a patch bump if no release type is provided. Use --dry-run to
 * preview the next values without saving them.
 */

const fs = require('fs');
const path = require('path');

const RELEASE_TYPES = new Set(['major', 'minor', 'patch']);

function parseArgs() {
  const [, , maybeType, maybeFlag] = process.argv;
  const releaseType = RELEASE_TYPES.has(maybeType) ? maybeType : 'patch';
  const dryRun = maybeType === '--dry-run' || maybeFlag === '--dry-run';
  return { releaseType, dryRun };
}

function ensureSemverTuple(version) {
  const parts = String(version || '0.0.0')
    .split('.')
    .map((value) => Number.parseInt(value, 10) || 0);
  while (parts.length < 3) parts.push(0);
  return parts.slice(0, 3);
}

function bumpVersion([major, minor, patch], releaseType) {
  switch (releaseType) {
    case 'major':
      return [major + 1, 0, 0];
    case 'minor':
      return [major, minor + 1, 0];
    case 'patch':
    default:
      return [major, minor, patch + 1];
  }
}

function formatVersion([major, minor, patch]) {
  return `${major}.${minor}.${patch}`;
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function saveJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function logPreview(current, next, dryRun) {
  const prefix = dryRun ? '[dry-run]' : '[update]';
  console.log(`${prefix} version: ${current.version} -> ${next.version}`);
  console.log(
    `${prefix} runtimeVersion: ${current.runtimeVersion} -> ${next.runtimeVersion}`
  );
  console.log(
    `${prefix} ios.buildNumber: ${current.iosBuildNumber} -> ${next.iosBuildNumber}`
  );
  console.log(
    `${prefix} android.versionCode: ${current.androidVersionCode} -> ${next.androidVersionCode}`
  );
}

function main() {
  const { releaseType, dryRun } = parseArgs();

  const appJsonPath = path.join(__dirname, '..', 'app.json');
  const packageJsonPath = path.join(__dirname, '..', 'package.json');

  const appJson = loadJson(appJsonPath);
  const packageJson = loadJson(packageJsonPath);

  if (!appJson.expo) {
    throw new Error('expo config missing from app.json');
  }

  const expoConfig = appJson.expo;
  const currentVersionTuple = ensureSemverTuple(expoConfig.version);
  const nextVersionTuple = bumpVersion(currentVersionTuple, releaseType);
  const nextVersion = formatVersion(nextVersionTuple);

  const currentBuildNumber =
    Number.parseInt(expoConfig?.ios?.buildNumber ?? '0', 10) || 0;
  const nextBuildNumber = currentBuildNumber + 1;

  const currentAndroidVersionCode =
    Number.parseInt(expoConfig?.android?.versionCode ?? '0', 10) || 0;
  const nextAndroidVersionCode = currentAndroidVersionCode + 1;

  const currentValues = {
    version: expoConfig.version ?? '0.0.0',
    runtimeVersion:
      typeof expoConfig.runtimeVersion === 'string'
        ? expoConfig.runtimeVersion
        : JSON.stringify(expoConfig.runtimeVersion),
    iosBuildNumber: expoConfig?.ios?.buildNumber ?? '0',
    androidVersionCode: expoConfig?.android?.versionCode ?? 0,
  };

  const nextValues = {
    version: nextVersion,
    runtimeVersion: nextVersion,
    iosBuildNumber: String(nextBuildNumber),
    androidVersionCode: nextAndroidVersionCode,
  };

  logPreview(currentValues, nextValues, dryRun);

  if (dryRun) {
    return;
  }

  expoConfig.version = nextValues.version;
  expoConfig.runtimeVersion = nextValues.runtimeVersion;
  expoConfig.ios = {
    ...expoConfig.ios,
    buildNumber: nextValues.iosBuildNumber,
  };
  expoConfig.android = {
    ...expoConfig.android,
    versionCode: nextValues.androidVersionCode,
  };

  packageJson.version = nextValues.version;

  saveJson(appJsonPath, appJson);
  saveJson(packageJsonPath, packageJson);

  console.log('Expo runtime version metadata updated successfully.');
}

main();
