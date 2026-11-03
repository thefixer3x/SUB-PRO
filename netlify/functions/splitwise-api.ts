import { requireUser, type NetlifyEvent, type NetlifyResult } from './_shared/auth';
import { getRequestOrigin, handlePreflight, isOriginAllowed, jsonResponse } from './_shared/cors';

/**
 * Splitwise proxy: disabled.
 *
 * The earlier version forwarded create/delete/remove-member calls to Splitwise with
 * one shared app key and no check that the caller owns the group, so any signed-in
 * user could act on any group. Nothing in the app calls this endpoint today.
 * Card S203 (docs/agents/EXECUTION_PLAN.md) rebuilds it as api/splitwise.ts with
 * per-user authorisation; until then it answers 501 to signed-in users.
 */
export const handler = async (event: NetlifyEvent): Promise<NetlifyResult> => {
  if (event.httpMethod === 'OPTIONS') {
    return handlePreflight(event);
  }

  const origin = getRequestOrigin(event);
  if (!isOriginAllowed(origin)) {
    return jsonResponse(403, { error: 'Origin not allowed' });
  }

  const auth = await requireUser(event);
  if (!auth.ok) {
    return auth.response;
  }

  return jsonResponse(501, { error: 'Splitwise integration is not available yet' }, origin);
};
