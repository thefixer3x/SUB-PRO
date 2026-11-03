import { readFileSync } from 'fs';
import path from 'path';

/**
 * The demo/mock user id is used as an ownership key by the card and
 * subscription APIs. If it is derived from `Math.random()` it is guessable,
 * which CodeQL reports as `js/insecure-randomness` in a security context.
 *
 * These tests pin the fix at the source (AuthContext) rather than asserting on
 * the generated value, so the check keeps working on every platform.
 */
describe('AuthContext demo user id', () => {
  const source = readFileSync(
    path.join(__dirname, '..', 'contexts', 'AuthContext.tsx'),
    'utf8',
  );

  // Strip comments so prose that names the vulnerable API is not mistaken for
  // a call to it.
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');

  const mockUserFactory = code.slice(
    code.indexOf('const createMockUser'),
    code.indexOf('const createMockSession'),
  );

  it('does not derive the mock user id from Math.random()', () => {
    expect(mockUserFactory).not.toMatch(/Math\.random/);
  });

  it('derives the mock user id from a CSPRNG', () => {
    expect(mockUserFactory).toMatch(/Crypto\.randomUUID\(\)/);
  });

  it('imports expo-crypto so the CSPRNG is available on native and web', () => {
    expect(code).toMatch(/import \* as Crypto from 'expo-crypto'/);
  });
});
