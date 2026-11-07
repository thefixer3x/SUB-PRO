/** Vercel function for Plan inbox and envelope routes. */

import { handleP1Request } from '../../../server/p1-api';

export const runtime = 'nodejs';

export async function handler(request: Request): Promise<Response> {
  return handleP1Request(request);
}

export default { fetch: handler };
