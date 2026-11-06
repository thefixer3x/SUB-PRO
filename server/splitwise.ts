/**
 * Splitwise proxy business logic.
 *
 * Ported from netlify/functions/splitwise-api.ts.  Returns 501 until
 * per-user authorisation is implemented (card S203 follow-up).
 */

export interface SplitwiseResult {
  error: string;
  statusCode: number;
}

/**
 * The Splitwise integration is disabled.
 *
 * The earlier version forwarded calls with one shared app key and no check
 * that the caller owns the group, so any signed-in user could act on any
 * group.  This function returns 501 to prevent that until proper
 * authorisation is added.
 */
export const handleSplitwise = async (): Promise<SplitwiseResult> => {
  return {
    error: 'Splitwise integration is not available yet',
    statusCode: 501,
  };
};
