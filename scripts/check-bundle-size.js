#!/usr/bin/env node
/* eslint-env node */
/**
 * Enforces the web bundle budget in perf-budget.json against an `expo export`
 * output directory (default: dist).
 *
 *   initial JS = scripts index.html loads on first paint (what users wait for)
 *   total JS   = every .js file under _expo/static/js (catches lazy chunks)
 *
 * Sizes are gzip level 9, which is close to what Vercel/Netlify serve.
 * Exit code 1 when a budget's `max` is exceeded; `target` is report-only.
 *
 * Usage: node scripts/check-bundle-size.js [distDir] [budgetFile]
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const KB = 1024;

function gzipKB(file) {
  return zlib.gzipSync(fs.readFileSync(file), { level: 9 }).length / KB;
}

function listJs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listJs(full);
    return entry.name.endsWith('.js') ? [full] : [];
  });
}

/** Script files referenced by <script src> in index.html, resolved inside distDir. */
function initialScripts(distDir) {
  const html = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');
  const srcs = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+\.js)["']/gi)].map((m) => m[1]);
  return srcs
    .filter((src) => !/^(https?:)?\/\//i.test(src))
    .map((src) => path.join(distDir, src.replace(/^\//, '')))
    .filter((file) => fs.existsSync(file));
}

function measure(distDir) {
  const initial = initialScripts(distDir);
  const all = listJs(path.join(distDir, '_expo', 'static', 'js'));
  const sum = (files) => files.reduce((total, f) => total + gzipKB(f), 0);
  return {
    initialJsGzipKB: sum(initial),
    totalJsGzipKB: sum(all),
    files: { initial: initial.length, total: all.length },
  };
}

function evaluate(sizes, budgets) {
  return Object.entries(budgets).map(([metric, budget]) => {
    const actual = sizes[metric];
    return {
      metric,
      actual,
      max: budget.max,
      target: budget.target,
      overMax: typeof budget.max === 'number' && actual > budget.max,
      overTarget: typeof budget.target === 'number' && actual > budget.target,
    };
  });
}

function report(results) {
  const fmt = (n) => (typeof n === 'number' ? `${n.toFixed(1)} KB` : '—');
  const rows = results.map((r) => {
    const status = r.overMax ? '❌ over budget' : r.overTarget ? '⚠️ within budget, above target' : '✅';
    return `| ${r.metric} | ${fmt(r.actual)} | ${fmt(r.max)} | ${fmt(r.target)} | ${status} |`;
  });
  return [
    '### Web bundle budget (gzip)',
    '',
    '| Metric | Actual | Max (fails CI) | Target | Status |',
    '|---|---|---|---|---|',
    ...rows,
    '',
    'Budget file: `perf-budget.json`. Lower `max` when the bundle shrinks.',
  ].join('\n');
}

function main() {
  const distDir = path.resolve(process.argv[2] || 'dist');
  const budgetFile = path.resolve(process.argv[3] || path.join(__dirname, '..', 'perf-budget.json'));

  if (!fs.existsSync(path.join(distDir, 'index.html'))) {
    console.error(`No index.html in ${distDir}. Run \`expo export --platform web --output-dir dist\` first.`);
    process.exit(2);
  }

  const { budgets } = JSON.parse(fs.readFileSync(budgetFile, 'utf8'));
  const sizes = measure(distDir);
  if (sizes.files.initial === 0) {
    console.error('index.html references no local scripts; cannot measure the initial bundle.');
    process.exit(2);
  }

  const results = evaluate(sizes, budgets);
  const markdown = report(results);
  console.log(markdown);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);

  const failed = results.filter((r) => r.overMax);
  if (failed.length) {
    for (const r of failed) {
      console.error(`Bundle budget exceeded: ${r.metric} is ${r.actual.toFixed(1)} KB, max ${r.max} KB.`);
    }
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = { measure, evaluate, report, initialScripts };
