/**
 * Vercel compiles every function in api/ (and the server/ modules it
 * imports) with the tsconfig.json nearest to the function. package.json is
 * "type": "commonjs", so those functions must be emitted as CommonJS: ESM
 * output crashes on load ("Cannot use import statement outside a module")
 * and every /api route returns FUNCTION_INVOCATION_FAILED.
 */
import fs from 'fs';
import path from 'path';
import ts from 'typescript';

const root = path.resolve(__dirname, '..');

function compiledFor(entry: string): string {
  const configPath = ts.findConfigFile(path.dirname(path.join(root, entry)), ts.sys.fileExists);
  if (!configPath) throw new Error(`no tsconfig.json found for ${entry}`);
  const { config, error } = ts.readConfigFile(configPath, ts.sys.readFile);
  if (error) throw new Error(ts.flattenDiagnosticMessageText(error.messageText, '\n'));
  const parsed = ts.parseJsonConfigFileContent(config, ts.sys, path.dirname(configPath));
  const source = fs.readFileSync(path.join(root, entry), 'utf8');
  return ts.transpileModule(source, { compilerOptions: parsed.options, fileName: entry }).outputText;
}

describe('api/ functions module format', () => {
  it('package.json stays CommonJS (the reason api/tsconfig.json exists)', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    expect(pkg.type).toBe('commonjs');
  });

  it.each([
    'api/create-checkout-session.ts',
    'api/stripe/webhook.ts',
    'api/embedded-finance/virtual-cards/[...path].ts',
  ])('%s compiles to CommonJS', (entry) => {
    const out = compiledFor(entry);
    expect(out).toMatch(/require\("\.\.\/(\.\.\/)*server\//);
    expect(out).not.toMatch(/^import\s/m);
    expect(out).not.toMatch(/^export\s/m);
  });
});
