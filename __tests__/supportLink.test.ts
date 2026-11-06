import { resolveSupportLink } from '@/config/support';

describe('resolveSupportLink', () => {
  it('is null when nothing is configured', () => {
    expect(resolveSupportLink(undefined, undefined)).toBeNull();
    expect(resolveSupportLink('  ', '')).toBeNull();
  });

  it('prefers an https URL', () => {
    expect(resolveSupportLink('https://help.example.com/start', 'a@example.com')).toEqual({
      kind: 'url',
      href: 'https://help.example.com/start',
      label: 'help.example.com',
    });
  });

  it('rejects non-https URLs and falls back to email', () => {
    expect(resolveSupportLink('http://help.example.com', 'a@example.com')?.href).toBe('mailto:a@example.com');
    expect(resolveSupportLink('javascript:alert(1)', undefined)).toBeNull();
    expect(resolveSupportLink('not a url', undefined)).toBeNull();
  });

  it('accepts a plain email and rejects malformed ones', () => {
    expect(resolveSupportLink(undefined, ' help@example.com ')?.href).toBe('mailto:help@example.com');
    expect(resolveSupportLink(undefined, 'help@example')).toBeNull();
    expect(resolveSupportLink(undefined, 'a@b.com?cc=x@y.com')).toBeNull();
  });
});
