/* eslint-env jest, node */
/**
 * scripts/check-bundle-size.js enforces perf-budget.json in CI.
 * These tests pin what it measures and when it fails.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { measure, evaluate, initialScripts } = require('../scripts/check-bundle-size');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'check-bundle-size.js');

function makeDist({ html, files }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bundle-budget-'));
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  return dir;
}

// Random bytes do not compress, so gzip size ≈ raw size.
const incompressible = (kb) => require('crypto').randomBytes(kb * 1024);

function writeBudget(dir, max) {
  const file = path.join(dir, 'budget.json');
  fs.writeFileSync(file, JSON.stringify({ budgets: { initialJsGzipKB: { max, target: 1 } } }));
  return file;
}

describe('check-bundle-size', () => {
  it('counts only the scripts index.html loads as initial JS, and every chunk as total JS', () => {
    const dist = makeDist({
      html: '<script src="/_expo/static/js/web/entry.js" defer></script><script src="https://cdn.example/x.js"></script>',
      files: {
        '_expo/static/js/web/entry.js': incompressible(20),
        '_expo/static/js/web/lazy-route.js': incompressible(10),
      },
    });
    expect(initialScripts(dist)).toHaveLength(1);
    const sizes = measure(dist);
    expect(sizes.initialJsGzipKB).toBeGreaterThan(19);
    expect(sizes.initialJsGzipKB).toBeLessThan(22);
    expect(sizes.totalJsGzipKB).toBeGreaterThan(sizes.initialJsGzipKB + 9);
  });

  it('fails only on max; the target is report-only', () => {
    const [within] = evaluate({ initialJsGzipKB: 300 }, { initialJsGzipKB: { max: 400, target: 200 } });
    expect(within).toMatchObject({ overMax: false, overTarget: true });
    const [over] = evaluate({ initialJsGzipKB: 401 }, { initialJsGzipKB: { max: 400, target: 200 } });
    expect(over.overMax).toBe(true);
  });

  it('exits 1 when the bundle is over budget and 0 when within it', () => {
    const dist = makeDist({
      html: '<script src="/_expo/static/js/web/entry.js"></script>',
      files: { '_expo/static/js/web/entry.js': incompressible(30) },
    });
    const run = (max) => {
      try {
        execFileSync('node', [SCRIPT, dist, writeBudget(dist, max)], { stdio: 'pipe', env: { ...process.env, GITHUB_STEP_SUMMARY: '' } });
        return 0;
      } catch (error) {
        return error.status;
      }
    };
    expect(run(100)).toBe(0);
    expect(run(10)).toBe(1);
  });

  it('refuses to pass when nothing was built', () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'bundle-budget-empty-'));
    expect(() => execFileSync('node', [SCRIPT, empty], { stdio: 'pipe' })).toThrow();
  });

  it('keeps the committed budget no looser than baseline + 5%', () => {
    const { baseline, budgets } = require('../perf-budget.json');
    expect(budgets.initialJsGzipKB.max).toBeLessThanOrEqual(Math.ceil(baseline.initialJsGzipKB * 1.05));
    expect(budgets.initialJsGzipKB.target).toBe(200);
  });
});
