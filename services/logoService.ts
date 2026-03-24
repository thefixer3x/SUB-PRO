/**
 * logoService.ts
 * Fetches high-resolution brand logos using a priority chain:
 *   1. logo.dev (21st.dev API) – best quality SVG/PNG
 *   2. Clearbit Logo API       – good fallback, free
 *   3. Google Favicons          – last resort
 */

// ---------------------------------------------------------------------------
// Known domain map for popular subscriptions
// ---------------------------------------------------------------------------
const DOMAIN_MAP: Record<string, string> = {
  // Productivity
  'notion': 'notion.so',
  'clickup': 'clickup.com',
  'asana': 'asana.com',
  'monday': 'monday.com',
  'trello': 'trello.com',
  'airtable': 'airtable.com',
  'todoist': 'todoist.com',
  'evernote': 'evernote.com',
  'obsidian': 'obsidian.md',
  'roam': 'roamresearch.com',

  // AI
  'chatgpt': 'openai.com',
  'chatgpt plus': 'openai.com',
  'openai': 'openai.com',
  'claude': 'anthropic.com',
  'claude pro': 'anthropic.com',
  'anthropic': 'anthropic.com',
  'elevenlabs': 'elevenlabs.io',
  'midjourney': 'midjourney.com',
  'perplexity': 'perplexity.ai',
  'runway': 'runwayml.com',
  'copy.ai': 'copy.ai',
  'jasper': 'jasper.ai',
  'grammarly': 'grammarly.com',

  // Entertainment
  'netflix': 'netflix.com',
  'spotify': 'spotify.com',
  'apple music': 'music.apple.com',
  'apple tv': 'tv.apple.com',
  'disney': 'disneyplus.com',
  'disney+': 'disneyplus.com',
  'hulu': 'hulu.com',
  'youtube premium': 'youtube.com',
  'youtube': 'youtube.com',
  'hbo': 'max.com',
  'max': 'max.com',
  'amazon prime': 'amazon.com',
  'prime video': 'amazon.com',
  'tidal': 'tidal.com',
  'deezer': 'deezer.com',
  'audible': 'audible.com',
  'twitch': 'twitch.tv',
  'crunchyroll': 'crunchyroll.com',

  // Creative
  'adobe': 'adobe.com',
  'adobe creative cloud': 'adobe.com',
  'adobe creative': 'adobe.com',
  'figma': 'figma.com',
  'canva': 'canva.com',
  'sketch': 'sketch.com',
  'affinity': 'affinity.serif.com',
  'procreate': 'procreate.art',
  'framer': 'framer.com',
  'invision': 'invisionapp.com',

  // Development
  'github': 'github.com',
  'gitlab': 'gitlab.com',
  'vercel': 'vercel.com',
  'netlify': 'netlify.com',
  'heroku': 'heroku.com',
  'digitalocean': 'digitalocean.com',
  'aws': 'aws.amazon.com',
  'gcp': 'cloud.google.com',
  'azure': 'azure.microsoft.com',
  'linear': 'linear.app',
  'jira': 'atlassian.com',
  'confluence': 'atlassian.com',
  'bitbucket': 'bitbucket.org',
  'postman': 'postman.com',
  'datadog': 'datadoghq.com',
  'sentry': 'sentry.io',
  'replit': 'replit.com',

  // Communication
  'slack': 'slack.com',
  'zoom': 'zoom.us',
  'discord': 'discord.com',
  'microsoft 365': 'microsoft.com',
  'office 365': 'microsoft.com',
  'google workspace': 'workspace.google.com',
  'gsuite': 'workspace.google.com',
  'intercom': 'intercom.com',
  'loom': 'loom.com',
  'typeform': 'typeform.com',

  // Finance
  'quickbooks': 'quickbooks.intuit.com',
  'xero': 'xero.com',
  'freshbooks': 'freshbooks.com',
  'stripe': 'stripe.com',
  'plaid': 'plaid.com',

  // Health & Fitness
  'calm': 'calm.com',
  'headspace': 'headspace.com',
  'peloton': 'onepeloton.com',
  'noom': 'noom.com',
  'strava': 'strava.com',
  'myfitnesspal': 'myfitnesspal.com',

  // Education
  'duolingo': 'duolingo.com',
  'coursera': 'coursera.org',
  'udemy': 'udemy.com',
  'skillshare': 'skillshare.com',
  'masterclass': 'masterclass.com',
  'pluralsight': 'pluralsight.com',
  'linkedin learning': 'linkedin.com',

  // Cloud Storage
  'dropbox': 'dropbox.com',
  'box': 'box.com',
  'onedrive': 'onedrive.live.com',
  'icloud': 'icloud.com',
  'google drive': 'drive.google.com',
  'google one': 'one.google.com',

  // Security
  '1password': '1password.com',
  'lastpass': 'lastpass.com',
  'nordvpn': 'nordvpn.com',
  'expressvpn': 'expressvpn.com',
  'dashlane': 'dashlane.com',

  // Misc SaaS
  'hubspot': 'hubspot.com',
  'salesforce': 'salesforce.com',
  'mailchimp': 'mailchimp.com',
  'shopify': 'shopify.com',
  'webflow': 'webflow.com',
  'wix': 'wix.com',
  'squarespace': 'squarespace.com',
  'notion ai': 'notion.so',
  'zapier': 'zapier.com',
  'make': 'make.com',
  'n8n': 'n8n.io',
};

// ---------------------------------------------------------------------------
// Logo URL builders
// ---------------------------------------------------------------------------

/**
 * logo.dev (21st.dev) – Requires API token from https://logo.dev
 * Set EXPO_PUBLIC_LOGO_DEV_TOKEN in your .env file.
 */
function getLogoDevUrl(domain: string, size = 128): string {
  const token = process.env.EXPO_PUBLIC_LOGO_DEV_TOKEN ?? '';
  return `https://img.logo.dev/${domain}?token=${token}&size=${size}&format=png`;
}

/** Clearbit Logo API – free, no auth required */
function getClearbitUrl(domain: string, size = 128): string {
  return `https://logo.clearbit.com/${domain}?size=${size}`;
}

/** Google S2 favicon – always available as last resort */
function getGoogleFaviconUrl(domain: string, size = 64): string {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`;
}

// ---------------------------------------------------------------------------
// Domain resolver
// ---------------------------------------------------------------------------

/**
 * Extracts the root domain from a URL string or subscription name.
 * e.g. "https://www.netflix.com/account" → "netflix.com"
 *      "Netflix"                          → "netflix.com" (via DOMAIN_MAP)
 */
export function resolveDomain(nameOrUrl: string): string | null {
  if (!nameOrUrl) return null;

  // If it looks like a URL, extract hostname
  if (nameOrUrl.includes('.')) {
    try {
      const url = nameOrUrl.startsWith('http') ? nameOrUrl : `https://${nameOrUrl}`;
      const { hostname } = new URL(url);
      return hostname.replace(/^www\./, '');
    } catch {
      // not a valid URL, fall through
    }
  }

  // Lookup in known map (case-insensitive)
  const key = nameOrUrl.toLowerCase().trim();
  return DOMAIN_MAP[key] ?? null;
}

// ---------------------------------------------------------------------------
// Logo URL chain
// ---------------------------------------------------------------------------

export interface LogoUrls {
  /** Best quality – logo.dev (21st.dev) */
  primary: string;
  /** Good fallback – Clearbit */
  secondary: string;
  /** Always works – Google favicon */
  fallback: string;
}

/**
 * Returns an ordered set of logo URLs for a given subscription name or domain.
 * Use `primary` first, fall back to `secondary`, then `fallback`.
 */
export function getLogoUrls(nameOrUrl: string, size = 128): LogoUrls | null {
  const domain = resolveDomain(nameOrUrl);
  if (!domain) return null;

  return {
    primary: getLogoDevUrl(domain, size),
    secondary: getClearbitUrl(domain, size),
    fallback: getGoogleFaviconUrl(domain, Math.min(size, 64)),
  };
}

// ---------------------------------------------------------------------------
// In-memory cache (avoids repeated network hits during a session)
// ---------------------------------------------------------------------------

const logoCache = new Map<string, string>();

/**
 * Returns the best working logo URL for a domain.
 * Tries primary → secondary → fallback by testing each URL.
 * Result is cached for the session.
 *
 * NOTE: This is async and intended for non-render contexts (e.g., pre-fetch).
 * For rendering, use the <SubscriptionLogo /> component which handles fallback natively.
 */
export async function fetchBestLogoUrl(nameOrUrl: string, size = 128): Promise<string | null> {
  const domain = resolveDomain(nameOrUrl);
  if (!domain) return null;

  if (logoCache.has(domain)) return logoCache.get(domain)!;

  const urls = getLogoUrls(nameOrUrl, size);
  if (!urls) return null;

  for (const url of [urls.primary, urls.secondary, urls.fallback]) {
    try {
      const res = await fetch(url, { method: 'HEAD' });
      if (res.ok) {
        logoCache.set(domain, url);
        return url;
      }
    } catch {
      // try next
    }
  }

  return null;
}
