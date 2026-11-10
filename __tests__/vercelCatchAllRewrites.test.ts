import fs from 'fs';
import path from 'path';

// Outside Next.js, Vercel treats api/**/[...name].ts as a single path segment,
// so /plan/insights reaches the function but /plan/insights/consent is a 404.
// Each catch-all function therefore needs a rewrite for deeper paths.
const root = path.join(__dirname, '..');
const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
const rewrites: { source: string; destination: string }[] = vercel.rewrites;

function catchAllFunctions(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return catchAllFunctions(full);
    return /^\[\.\.\.[^\]]+\]\.ts$/.test(entry.name) ? [full] : [];
  });
}

function rewrite(url: string): string | null {
  for (const r of rewrites) {
    const m = new RegExp(`^${r.source}$`).exec(url);
    if (m) return r.destination.replace(/\$(\d)/g, (_, i) => m[Number(i)]);
  }
  return null;
}

describe('catch-all API functions on Vercel', () => {
  const bases = catchAllFunctions(path.join(root, 'api')).map(
    (f) => '/' + path.relative(root, path.dirname(f)).split(path.sep).join('/'),
  );

  it('finds the catch-all functions', () => {
    expect(bases).toEqual(
      expect.arrayContaining(['/api/embedded-finance/plan', '/api/embedded-finance/virtual-cards']),
    );
  });

  it.each(bases)('%s routes nested paths to its function', (base) => {
    expect(rewrite(`${base}/insights/consent`)).toBe(`${base}/insights`);
    expect(rewrite(`${base}/a/b/c`)).toBe(`${base}/a`);
  });

  it('these rewrites come before the SPA fallback', () => {
    const spa = rewrites.findIndex((r) => r.destination === '/index.html');
    const nested = rewrites.findIndex((r) => r.source.startsWith('/api/embedded-finance/plan/'));
    expect(nested).toBeGreaterThanOrEqual(0);
    expect(nested).toBeLessThan(spa);
  });
});
