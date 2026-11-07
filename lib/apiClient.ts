const DEFAULT_TIMEOUT_MS = 8000;

const sanitizeBase = (base: string) => base.replace(/\/+$/, '');
const ensureLeadingSlash = (path: string) => (path.startsWith('/') ? path : `/${path}`);

const buildUrlFromBase = (base: string, path: string) => {
  if (!base) {
    return ensureLeadingSlash(path);
  }
  return `${sanitizeBase(base)}${ensureLeadingSlash(path)}`;
};

const dedupe = (values: string[]) => {
  return values.filter((value, index) => values.indexOf(value) === index);
};

export const buildApiBases = (
  candidates: (string | undefined | null)[],
  { includeRelative = true }: { includeRelative?: boolean } = {}
): string[] => {
  const bases: string[] = [];

  candidates.forEach((candidate) => {
    const trimmed = candidate?.trim();
    if (!trimmed) {
      return;
    }
    bases.push(sanitizeBase(trimmed));
  });

  if (includeRelative) {
    bases.push('');
  }

  return dedupe(bases);
};

export const fetchWithTimeout = async (
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<Response> => {
  const supportsAbort = typeof AbortController !== 'undefined';
  const originalSignal = (init as RequestInit & { signal?: AbortSignal }).signal;

  if (!supportsAbort || timeoutMs <= 0 || originalSignal) {
    return fetch(input, init);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => {
    if (!controller.signal.aborted) {
      controller.abort();
    }
  }, timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

export interface RequestWithFallbackOptions<T> {
  timeoutMs?: number;
  bases?: string[];
  urls?: string[];
  allowRelative?: boolean;
  parser?: (response: Response) => Promise<T>;
  /**
   * Whether a non-2xx response should fall through to the next candidate
   * URL. Defaults to always. Pass a predicate for non-idempotent requests
   * (e.g. creating a checkout session) so a real answer from the server,
   * such as 401 or 400, is final instead of being re-sent elsewhere.
   */
  tryNextOnStatus?: (status: number) => boolean;
}

/** An HTTP error from requestWithFallback that was not retried. */
export class ApiHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly serverMessage: string | null,
  ) {
    super(message);
    this.name = 'ApiHttpError';
  }
}

export const requestWithFallback = async <T>(
  path: string,
  init: RequestInit = {},
  options: RequestWithFallbackOptions<T> = {}
): Promise<T> => {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    bases = [],
    urls = [],
    allowRelative = true,
    parser,
    tryNextOnStatus = () => true,
  } = options;

  const parse = parser ?? (async (response: Response) => (await response.json()) as T);

  const urlCandidates = dedupe([
    ...urls,
    ...buildUrlList(path, bases, allowRelative),
  ].filter((value): value is string => Boolean(value && value.trim())));

  if (!urlCandidates.length) {
    throw new Error('No API endpoints configured');
  }

  const errors: string[] = [];

  for (const url of urlCandidates) {
    try {
      const response = await fetchWithTimeout(url, init, timeoutMs);
      if (!response.ok) {
        const message = await safeExtractError(response);
        const detail = `${response.status} ${response.statusText} for ${url}${message ? `: ${message}` : ''}`;
        if (!tryNextOnStatus(response.status)) {
          throw new ApiHttpError([...errors, detail].join('; '), response.status, message);
        }
        errors.push(detail);
        continue;
      }
      return await parse(response);
    } catch (error) {
      if (error instanceof ApiHttpError) throw error;
      const reason = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Request to ${url} failed: ${reason}`);
    }
  }

  throw new Error(errors.join('; ') || 'All API endpoints failed');
};

const buildUrlList = (path: string, bases: string[], allowRelative: boolean): string[] => {
  const sanitizedBases = bases.length ? bases : [''];
  const urls = sanitizedBases.map((base) => buildUrlFromBase(base, path));

  if (allowRelative) {
    urls.push(ensureLeadingSlash(path));
  }

  return dedupe(urls);
};

const safeExtractError = async (response: Response): Promise<string | null> => {
  const contentType = response.headers.get('content-type') ?? '';

  try {
    if (contentType.includes('application/json')) {
      const data = await response.json();
      if (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string') {
        return data.error;
      }
      return JSON.stringify(data);
    }

    const text = await response.text();
    return text.trim() || null;
  } catch {
    return null;
  }
};

export const buildUrl = buildUrlFromBase;
export const DEFAULT_API_TIMEOUT_MS = DEFAULT_TIMEOUT_MS;
