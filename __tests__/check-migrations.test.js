/* eslint-env jest, node */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const script = path.join(__dirname, '..', 'scripts', 'check-migrations.js');

describe('check-migrations', () => {
  let dir;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sub-pro-migrations-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  function add(name) {
    fs.writeFileSync(path.join(dir, name), '-- test migration\n');
  }

  function run() {
    return spawnSync(process.execPath, [script, '--dir', dir], { encoding: 'utf8' });
  }

  it('accepts a unique forward migration', () => {
    add('20261107000006_example.sql');
    const result = run();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Migration check passed');
  });

  it('rejects rollback files even with a unique version', () => {
    add('20261107000006_example.rollback.sql');
    const result = run();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('rollback files belong in supabase/rollbacks');
  });

  it('validates uppercase SQL extensions instead of silently ignoring them', () => {
    add('20261107000006_example.SQL');
    const result = run();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('does not match <version>_<name>.sql');
  });

  it('allows only the exact already-shipped 20250701 duplicate pair', () => {
    add('20250701_rls_policy_wrappers.sql');
    add('20250701_security_and_perf_hardening.sql');
    expect(run().status).toBe(0);

    add('20250701_new_file.sql');
    const result = run();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Duplicate migration version 20250701');
  });
});
