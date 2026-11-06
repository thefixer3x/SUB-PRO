/**
 * Where the "Help & Support" row in Settings sends people.
 *
 * Set one of these at build time (Vercel / EAS env):
 *   EXPO_PUBLIC_SUPPORT_URL    an https:// page, preferred when both are set
 *   EXPO_PUBLIC_SUPPORT_EMAIL  an address, opened as mailto:
 *
 * With neither set, or with an invalid value, there is no support link and
 * the row is hidden, so the app never links to a page that does not exist.
 */

export type SupportLink =
  | { kind: 'url'; href: string; label: string }
  | { kind: 'email'; href: string; label: string };

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[A-Za-z]{2,}$/;

export function resolveSupportLink(
  url: string | undefined,
  email: string | undefined,
): SupportLink | null {
  const rawUrl = url?.trim();
  if (rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol === 'https:' && parsed.hostname) {
        return { kind: 'url', href: parsed.toString(), label: parsed.hostname };
      }
    } catch {
      // fall through to the email option
    }
  }

  const rawEmail = email?.trim();
  if (rawEmail && EMAIL_RE.test(rawEmail)) {
    return { kind: 'email', href: `mailto:${rawEmail}`, label: rawEmail };
  }

  return null;
}

/** The support link for this build. Read with literal names so Expo inlines them. */
export function getSupportLink(): SupportLink | null {
  return resolveSupportLink(
    process.env.EXPO_PUBLIC_SUPPORT_URL,
    process.env.EXPO_PUBLIC_SUPPORT_EMAIL,
  );
}
