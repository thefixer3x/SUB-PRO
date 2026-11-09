import { Platform } from 'react-native';
import { buildApiBases, buildUrl, requestWithFallback } from '@/lib/apiClient';
import type { EnvelopeInput, EnvelopeRecord, InsightRecord } from '@/types/planInbox';
import type { EnvelopeSummary } from './envelopeMath';

const API_BASES = buildApiBases(
  [
    process.env.EXPO_PUBLIC_API_BASE_URL,
    process.env.EXPO_PUBLIC_API_FALLBACK_URL,
    process.env.EXPO_PUBLIC_EMBEDDED_FINANCE_API_BASE_URL,
  ],
  { includeRelative: false },
);

export class PlanInboxApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null,
  ) {
    super(message);
    this.name = 'PlanInboxApiError';
  }
}

function apiPath(path: string): string {
  return `/embedded-finance/plan/${path.replace(/^\/+/, '')}`;
}

async function request<T>(
  path: string,
  accessToken: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${accessToken}`);
  headers.set('Content-Type', 'application/json');

  const allowRelative = Platform.OS === 'web' && typeof window !== 'undefined';
  const relativeUrl = allowRelative ? buildUrl('/api', apiPath(path)) : null;

  try {
    return await requestWithFallback<T>(apiPath(path), { ...init, headers }, {
      bases: API_BASES,
      urls: relativeUrl ? [relativeUrl] : [],
      allowRelative: false,
      tryNextOnStatus: (status) => status === 404 || status === 405,
    });
  } catch (error) {
    const details = error as { status?: number; serverMessage?: string | null; message?: string };
    throw new PlanInboxApiError(
      details.serverMessage || details.message || 'Request failed',
      details.status ?? 0,
      details.serverMessage?.includes('pro_required') ? 'pro_required' : null,
    );
  }
}

export interface InsightConsent {
  enabled: boolean;
  consent_version: string | null;
  consented_at: string | null;
}

export interface InsightScanResult {
  consented: boolean;
  detected: number;
  created: number;
}

export async function getInsightConsent(accessToken: string): Promise<InsightConsent> {
  return request('insights/consent', accessToken);
}

export async function updateInsightConsent(
  accessToken: string,
  enabled: boolean,
): Promise<{ enabled: boolean; scan?: InsightScanResult; deletedInsights?: boolean }> {
  return request('insights/consent', accessToken, {
    method: 'PUT',
    body: JSON.stringify({ enabled }),
  });
}

export async function scanForInsights(accessToken: string): Promise<InsightScanResult> {
  return request('insights/scan', accessToken, { method: 'POST', body: '{}' });
}

export async function getInsights(accessToken: string): Promise<InsightRecord[]> {
  const result = await request<{ insights: InsightRecord[] }>('insights', accessToken);
  return result.insights;
}

export async function updateInsight(
  accessToken: string,
  id: string,
  action: 'accept' | 'dismiss',
): Promise<InsightRecord> {
  const result = await request<{ insight: InsightRecord }>(`insights/${encodeURIComponent(id)}`, accessToken, {
    method: 'PATCH',
    body: JSON.stringify({ action }),
  });
  return result.insight;
}

export async function getEnvelopeSummary(accessToken: string): Promise<EnvelopeSummary[]> {
  const result = await request<{ summary: EnvelopeSummary[] }>('envelopes/summary', accessToken);
  return result.summary;
}

export async function createEnvelope(
  accessToken: string,
  body: EnvelopeInput & { currency: string },
): Promise<EnvelopeRecord> {
  const result = await request<{ envelope: EnvelopeRecord }>('envelopes', accessToken, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return result.envelope;
}

export async function deleteEnvelope(accessToken: string, id: string): Promise<void> {
  await request<{ deleted: boolean }>(`envelopes/${encodeURIComponent(id)}`, accessToken, {
    method: 'DELETE',
  });
}
