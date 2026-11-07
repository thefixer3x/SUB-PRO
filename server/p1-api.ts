/** Vercel adapter logic for the P1 envelope and Plan inbox endpoints. */

import {
  createEnvelope,
  deleteEnvelope,
  EnvelopeValidationError,
  getEnvelopeSummary,
  listEnvelopes,
  updateEnvelope,
  validateEnvelopeInput,
} from './envelopes';
import {
  createSupabaseInsightStore,
  getConsent,
  getUserTier,
  listInsights,
  scanInsights,
  setConsent,
  updateInsightStatus,
} from './insights';
import { authenticateP1Route, isUuid, jsonFrom, preflight, readJson } from './p1-route';
import type { InsightStatus } from '../types/planInbox';

const ROUTE_PREFIX = '/api/embedded-finance/plan/';
const VALID_STATUSES = new Set<InsightStatus>(['new', 'accepted', 'dismissed']);

function decodeSegments(path: string): string[] | null {
  try {
    return path.split('/').filter(Boolean).map((segment) => decodeURIComponent(segment));
  } catch {
    return null;
  }
}

function methodNotAllowed(request: Request): Response {
  return jsonFrom(request, 405, { error: 'Method not allowed' });
}

export async function handleP1Request(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return preflight(request) ?? new Response(null, { status: 204 });
  }

  const pathname = new URL(request.url).pathname;
  if (!pathname.startsWith(ROUTE_PREFIX)) {
    return jsonFrom(request, 404, { error: 'Route not found' });
  }

  const segments = decodeSegments(pathname.slice(ROUTE_PREFIX.length));
  if (!segments || segments.length === 0) {
    return jsonFrom(request, 404, { error: 'Route not found' });
  }

  const auth = await authenticateP1Route(request);
  if (!auth.ok) return auth.response;

  try {
    return await dispatchP1Request(request, auth, segments);
  } catch (error) {
    console.error('[api/embedded-finance/plan] request failed:', error);
    return jsonFrom(request, 500, { error: 'Could not complete the request' });
  }
}

async function dispatchP1Request(
  request: Request,
  auth: Extract<Awaited<ReturnType<typeof authenticateP1Route>>, { ok: true }>,
  segments: string[],
): Promise<Response> {
  const [resource, second] = segments;

  if (resource === 'insights') {
    if (segments.length === 1 && request.method === 'GET') {
      const consent = await getConsent(auth.admin, auth.userId);
      if (!consent.enabled) return jsonFrom(request, 200, { insights: [] });

      const rawStatus = new URL(request.url).searchParams.get('status');
      if (rawStatus && !VALID_STATUSES.has(rawStatus as InsightStatus)) {
        return jsonFrom(request, 400, { error: 'Invalid insight status' });
      }
      const insights = await listInsights(
        auth.admin,
        auth.userId,
        rawStatus as InsightStatus | undefined,
      );
      return jsonFrom(request, 200, { insights });
    }

    if (segments.length === 2 && second === 'scan' && request.method === 'POST') {
      const result = await scanInsights(createSupabaseInsightStore(auth.admin), auth.userId);
      if (!result.consented) {
        return jsonFrom(request, 403, {
          error: 'Insight consent is required',
          code: 'consent_required',
        });
      }
      return jsonFrom(request, 200, result);
    }

    if (segments.length === 2 && second === 'consent') {
      if (request.method === 'GET') {
        return jsonFrom(request, 200, await getConsent(auth.admin, auth.userId));
      }
      if (request.method === 'PUT') {
        const body = await readJson(request);
        if (!body || typeof body.enabled !== 'boolean') {
          return jsonFrom(request, 400, { error: 'enabled must be a boolean' });
        }

        await setConsent(auth.admin, auth.userId, body.enabled);
        if (!body.enabled) {
          const { error } = await auth.admin
            .from('sm_insights')
            .delete()
            .eq('user_id', auth.userId);
          if (error) throw new Error(`Could not remove saved insights: ${error.message}`);
          return jsonFrom(request, 200, { enabled: false, deletedInsights: true });
        }

        const scan = await scanInsights(createSupabaseInsightStore(auth.admin), auth.userId);
        return jsonFrom(request, 200, { enabled: true, scan });
      }
      return methodNotAllowed(request);
    }

    if (segments.length === 2 && request.method === 'PATCH') {
      const id = second;
      if (!isUuid(id)) return jsonFrom(request, 400, { error: 'Invalid insight id' });
      const consent = await getConsent(auth.admin, auth.userId);
      if (!consent.enabled) {
        return jsonFrom(request, 409, {
          error: 'Insight consent is required',
          code: 'consent_required',
        });
      }
      const body = await readJson(request);
      const action = body?.action;
      if (action !== 'accept' && action !== 'dismiss') {
        return jsonFrom(request, 400, { error: 'action must be accept or dismiss' });
      }

      if (action === 'accept') {
        const tier = await getUserTier(auth.admin, auth.userId);
        if (tier === 'free') {
          return jsonFrom(request, 403, {
            error: 'Accepting insight actions requires Pro',
            code: 'pro_required',
          });
        }
      }

      const status: InsightStatus = action === 'accept' ? 'accepted' : 'dismissed';
      const insight = await updateInsightStatus(auth.admin, auth.userId, id, status);
      if (!insight) return jsonFrom(request, 404, { error: 'Insight not found' });
      return jsonFrom(request, 200, { insight });
    }

    return segments.length === 2 && second !== 'scan' && second !== 'consent'
      ? methodNotAllowed(request)
      : jsonFrom(request, 404, { error: 'Route not found' });
  }

  if (resource === 'envelopes') {
    if (segments.length === 2 && second === 'summary' && request.method === 'GET') {
      return jsonFrom(request, 200, {
        summary: await getEnvelopeSummary(auth.admin, auth.userId),
      });
    }

    if (segments.length === 1 && request.method === 'GET') {
      return jsonFrom(request, 200, {
        envelopes: await listEnvelopes(auth.admin, auth.userId),
      });
    }

    if (segments.length === 1 && request.method === 'POST') {
      const body = await readJson(request);
      if (!body) return jsonFrom(request, 400, { error: 'Expected a JSON object' });
      try {
        const input = validateEnvelopeInput(body);
        const envelope = await createEnvelope(auth.admin, auth.userId, input);
        return jsonFrom(request, 201, { envelope });
      } catch (error) {
        if (error instanceof EnvelopeValidationError) {
          return jsonFrom(request, 400, { error: error.message });
        }
        throw error;
      }
    }

    if (segments.length === 2 && second !== 'summary') {
      const id = second;
      if (!isUuid(id)) return jsonFrom(request, 400, { error: 'Invalid envelope id' });

      if (request.method === 'PATCH') {
        const body = await readJson(request);
        if (!body) return jsonFrom(request, 400, { error: 'Expected a JSON object' });
        try {
          const envelope = await updateEnvelope(
            auth.admin,
            auth.userId,
            id,
            validateEnvelopeInput(body),
          );
          if (!envelope) return jsonFrom(request, 404, { error: 'Envelope not found' });
          return jsonFrom(request, 200, { envelope });
        } catch (error) {
          if (error instanceof EnvelopeValidationError) {
            return jsonFrom(request, 400, { error: error.message });
          }
          throw error;
        }
      }

      if (request.method === 'DELETE') {
        const deleted = await deleteEnvelope(auth.admin, auth.userId, id);
        if (!deleted) return jsonFrom(request, 404, { error: 'Envelope not found' });
        return jsonFrom(request, 200, { deleted: true });
      }

      return methodNotAllowed(request);
    }

    return methodNotAllowed(request);
  }

  // Envelope spend linking is intentionally a separate CRON_SECRET-protected
  // Vercel function; user sessions cannot invoke the cross-user job.
  return jsonFrom(request, 404, { error: 'Route not found' });
}
