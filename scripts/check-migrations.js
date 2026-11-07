#!/usr/bin/env node
/**
 * Validates the files in supabase/migrations.
 *
 * The Supabase CLI parses a migration file name with the regex
 * `^([0-9]+)_(.*)\.sql$` and picks the *first* byte-sorted match for a given
 * version. That means:
 *
 *   - a file that does not match the pattern is silently ignored, and
 *   - `20261107000000_x.rollback.sql` sorts before `20261107000000_x.sql`, so
 *     the rollback would be picked instead of the forward migration.
 *
 * Both are easy to miss in review, so this script fails the build instead.
 * Rollbacks live in supabase/rollbacks/, not in supabase/migrations/.
 *
 * Usage: node scripts/check-migrations.js [--dir <path>]
 */

const fs = require('fs');
const path = require('path');

const MIGRATION_NAME = /^([0-9]+)_(.*)\.sql$/;
const DEFAULT_DIR = path.join(__dirname, '..', 'supabase', 'migrations');

// Versions that already shipped with more than one file. Both files were
// applied historically, so renaming either one would desync the migration
// history in every existing environment. New duplicates still fail.
const KNOWN_LEGACY_DUPLICATES = new Set(['20250701']);

function parseArgs(argv) {
  const index = argv.indexOf('--dir');
  if (index !== -1) {
    if (!argv[index + 1]) {
      console.error('--dir requires a path');
      process.exit(2);
    }
    return path.resolve(argv[index + 1]);
  }
  return DEFAULT_DIR;
}

function main() {
  const dir = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    console.error(`Migration directory not found: ${dir}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name)
    .sort();

  const problems = [];
  const byVersion = new Map();

  for (const file of files) {
    const match = MIGRATION_NAME.exec(file);
    if (!match) {
      problems.push(
        `${file}: does not match <version>_<name>.sql. ` +
          'The Supabase CLI will ignore it.',
      );
      continue;
    }

    const [, version] = match;
    if (!byVersion.has(version)) byVersion.set(version, []);
    byVersion.get(version).push(file);
  }

  for (const [version, group] of byVersion) {
    if (group.length > 1) {
      if (KNOWN_LEGACY_DUPLICATES.has(version)) {
        console.warn(
          `Legacy duplicate version ${version} (already applied, left as is): ${group.join(', ')}`,
        );
        continue;
      }
      problems.push(
        `Duplicate migration version ${version}: ${group.join(', ')}. ` +
          'The CLI applies only the first file it finds.',
      );
    }
  }

  if (problems.length > 0) {
    console.error('Migration check failed:');
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }

  console.log(
    `Migration check passed: ${files.length} file(s) in ${path.relative(process.cwd(), dir) || '.'}`,
  );
}

main();
