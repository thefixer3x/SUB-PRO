/**
 * Regression tests for the API-key format guard.
 *
 * Context: the app broke in production when the Supabase project disabled its legacy keys. The old
 * guard was `envAnonKey.length > 150`, which is true for a legacy anon JWT (~208 chars) but FALSE for
 * a publishable key (~40-50 chars). A valid new key was therefore replaced by a placeholder string,
 * and every request failed with an opaque 401. Length must never be the discriminator.
 */
import { isUsablePublicKey } from '../supabase';

const makeLegacyJwt = () => {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ iss: 'supabase', ref: 'projectref', role: 'anon' })).toString(
    'base64url',
  );
  const signature = 'x'.repeat(80);
  return `${header}.${payload}.${signature}`;
};

describe('isUsablePublicKey', () => {
  it('accepts a current-format publishable key', () => {
    expect(isUsablePublicKey('sb_publishable_AbCdEfGhIjKlMnOpQrStUv')).toBe(true);
  });

  it('accepts a legacy anon JWT', () => {
    const jwt = makeLegacyJwt();
    expect(jwt.length).toBeGreaterThan(150); // the property the old guard relied on
    expect(isUsablePublicKey(jwt)).toBe(true);
  });

  it('rejects the redacted placeholder that the history rewrite left behind', () => {
    expect(isUsablePublicKey('***REMOVED-SUPABASE-CREDENTIAL***')).toBe(false);
  });

  it('rejects an empty value', () => {
    expect(isUsablePublicKey('')).toBe(false);
  });

  it('rejects arbitrary non-key strings', () => {
    expect(isUsablePublicKey('unconfigured')).toBe(false);
    expect(isUsablePublicKey('public-anon-key-placeholder')).toBe(false);
    expect(isUsablePublicKey('sb_secret_doNotShipThis')).toBe(false);
  });

  it('never accepts a secret key even though it has the sb_ prefix', () => {
    expect(isUsablePublicKey('sb_secret_AbCdEfGhIjKlMnOpQrStUv')).toBe(false);
  });
});
